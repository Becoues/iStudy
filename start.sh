#!/usr/bin/env bash
# iStudy 启动脚本 —— 一键启动 Docker 容器
#
# 功能：
#   1. 检查 Docker 是否在运行
#   2. 检查 Obsidian 导出路径是否存在（不存在则创建）
#   3. 检测 docker-compose.yml / Dockerfile / 源码是否比镜像新，决定是否 rebuild
#   4. 检测正在运行的容器的卷挂载是否和当前 compose 一致，不一致则 recreate
#   5. 启动容器并显示访问 URL 和状态

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

CONTAINER_NAME="istudy"
IMAGE_NAME="knowledge-system-istudy:latest"
HOST_PORT="3002"
OBSIDIAN_PATH="/Users/mac/Documents/Main/AI_talking"

# Export host UID/GID so docker-compose can run the container as the host
# user — otherwise bind-mounted files (./data, obsidian vault) end up owned
# by root and the app can't write to them.
export LOCAL_UID="$(id -u)"
export LOCAL_GID="$(id -g)"
export OBSIDIAN_HOST_PATH="$OBSIDIAN_PATH"
export OBSIDIAN_PATH="$OBSIDIAN_PATH"

# --- 颜色输出 ---
if [ -t 1 ]; then
  BOLD="$(tput bold)"; DIM="$(tput dim)"; RED="$(tput setaf 1)"
  GREEN="$(tput setaf 2)"; YELLOW="$(tput setaf 3)"; BLUE="$(tput setaf 4)"
  RESET="$(tput sgr0)"
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; RESET=""
fi

info()  { echo "${BLUE}▸${RESET} $*"; }
ok()    { echo "${GREEN}✓${RESET} $*"; }
warn()  { echo "${YELLOW}⚠${RESET} $*"; }
err()   { echo "${RED}✗${RESET} $*" >&2; }

# --- 1. 检查 Docker ---
if ! command -v docker >/dev/null 2>&1; then
  err "未安装 Docker，请先安装 Docker Desktop"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  err "Docker daemon 未运行，请启动 Docker Desktop"
  exit 1
fi
ok "Docker 运行中"

# --- 2. 检查 Obsidian 路径 ---
if [ ! -d "$OBSIDIAN_PATH" ]; then
  warn "Obsidian 导出路径不存在，自动创建: $OBSIDIAN_PATH"
  mkdir -p "$OBSIDIAN_PATH"
fi
ok "Obsidian 路径就绪: $DIM$OBSIDIAN_PATH$RESET"

# --- 3. 判断是否需要 rebuild 镜像 ---
NEED_BUILD=0

if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  info "镜像不存在，需要构建"
  NEED_BUILD=1
else
  # 镜像创建时间（unix 秒）
  IMAGE_CREATED=$(docker image inspect "$IMAGE_NAME" --format '{{.Created}}')
  IMAGE_TS=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${IMAGE_CREATED%.*}" "+%s" 2>/dev/null || echo 0)

  # 检查关键文件是否比镜像新
  CHECK_FILES=(
    "Dockerfile"
    "docker-compose.yml"
    "docker-entrypoint.sh"
    "package.json"
    "package-lock.json"
    "prisma/schema.prisma"
  )
  for f in "${CHECK_FILES[@]}"; do
    if [ -f "$f" ]; then
      FILE_TS=$(stat -f "%m" "$f" 2>/dev/null || echo 0)
      if [ "$FILE_TS" -gt "$IMAGE_TS" ]; then
        info "$f 比镜像新，需要重建"
        NEED_BUILD=1
        break
      fi
    fi
  done

  # 检查 src 和 prisma 目录下是否有比镜像新的文件
  if [ "$NEED_BUILD" -eq 0 ]; then
    if find src prisma -type f -newer <(date -r "$IMAGE_TS" "+%Y-%m-%dT%H:%M:%S" 2>/dev/null; echo) 2>/dev/null | grep -q .; then
      info "源码比镜像新，需要重建"
      NEED_BUILD=1
    fi
  fi
fi

if [ "$NEED_BUILD" -eq 1 ]; then
  info "开始构建镜像..."
  docker compose build
  ok "镜像构建完成"
else
  ok "镜像是最新的，跳过构建"
fi

# --- 4. 判断现有容器状态 ---
NEED_RECREATE=0

if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  # 容器存在，检查镜像是否匹配最新镜像
  CONTAINER_IMAGE_ID=$(docker inspect "$CONTAINER_NAME" --format '{{.Image}}')
  LATEST_IMAGE_ID=$(docker image inspect "$IMAGE_NAME" --format '{{.Id}}' 2>/dev/null || echo "")
  if [ "$CONTAINER_IMAGE_ID" != "$LATEST_IMAGE_ID" ]; then
    info "容器使用的不是最新镜像，需要重建容器"
    NEED_RECREATE=1
  fi

  # 检查卷挂载数量（当前 compose 预期 3 个 bind mount）
  BINDS_COUNT=$(docker inspect "$CONTAINER_NAME" --format '{{len .HostConfig.Binds}}' 2>/dev/null || echo 0)
  if [ "$BINDS_COUNT" -lt 3 ]; then
    info "容器卷挂载不完整 ($BINDS_COUNT/3)，需要重建容器"
    NEED_RECREATE=1
  fi

  if [ "$NEED_RECREATE" -eq 1 ]; then
    warn "删除旧容器..."
    docker rm -f "$CONTAINER_NAME" >/dev/null
  fi
fi

# --- 5. 启动容器 ---
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  ok "容器已在运行"
else
  info "启动容器..."
  docker compose up -d
  ok "容器已启动"
fi

# --- 6. 健康检查 ---
echo ""
echo "${BOLD}容器状态${RESET}"
docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
ok "${BOLD}iStudy 已启动${RESET}"
echo "   ${BOLD}访问地址:${RESET} http://localhost:${HOST_PORT}"
echo "   ${DIM}查看日志: docker logs -f ${CONTAINER_NAME}${RESET}"
echo "   ${DIM}停止服务: docker compose down${RESET}"
