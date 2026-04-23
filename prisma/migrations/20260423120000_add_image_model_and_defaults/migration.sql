-- RedefineTables: add imageModel, change default model to gpt-5.4
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'DeerAPI',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'gpt-5.4',
    "imageModel" TEXT NOT NULL DEFAULT 'gpt-image-2',
    "obsidianPath" TEXT NOT NULL DEFAULT '/Users/mac/Documents/Main/AI_talking',
    "obsidianFolder" TEXT NOT NULL DEFAULT 'iStudy',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("apiKey", "id", "model", "obsidianFolder", "obsidianPath", "provider", "updatedAt")
    SELECT "apiKey", "id", "model", "obsidianFolder", "obsidianPath", "provider", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
