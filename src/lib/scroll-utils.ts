interface ScrollIntoContainerOptions {
  behavior?: ScrollBehavior;
  block?: "start" | "center" | "end" | "nearest";
  padding?: number;
}

export function scrollElementIntoContainer(
  container: HTMLElement,
  element: HTMLElement,
  {
    behavior = "smooth",
    block = "nearest",
    padding = 0,
  }: ScrollIntoContainerOptions = {}
) {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const currentTop = container.scrollTop;
  const elementTop = elementRect.top - containerRect.top + currentTop;
  const elementBottom = elementTop + elementRect.height;

  let nextTop = currentTop;

  if (block === "start") {
    nextTop = elementTop - padding;
  } else if (block === "center") {
    nextTop = elementTop - (container.clientHeight - elementRect.height) / 2;
  } else if (block === "end") {
    nextTop = elementBottom - container.clientHeight + padding;
  } else {
    const visibleTop = currentTop;
    const visibleBottom = currentTop + container.clientHeight;

    if (elementTop - padding < visibleTop) {
      nextTop = elementTop - padding;
    } else if (elementBottom + padding > visibleBottom) {
      nextTop = elementBottom + padding - container.clientHeight;
    } else {
      return;
    }
  }

  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

  container.scrollTo({
    top: Math.min(Math.max(0, nextTop), maxTop),
    behavior,
  });
}
