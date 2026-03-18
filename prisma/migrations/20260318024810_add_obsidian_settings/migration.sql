-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'DeerAPI',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o',
    "obsidianPath" TEXT NOT NULL DEFAULT '/Users/mac/Documents/Main/AI_talking',
    "obsidianFolder" TEXT NOT NULL DEFAULT 'iStudy',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("apiKey", "id", "model", "provider", "updatedAt") SELECT "apiKey", "id", "model", "provider", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
