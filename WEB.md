# Web vs native (EquaCards)

## Running the web app

From the repo root:

```bash
npm install
npx expo start --web
```

Or use the npm script:

```bash
npm run web
```

Expo loads `EXPO_PUBLIC_*` variables from `.env` (see `.env.example`). After changing env vars, restart the dev server so Metro picks them up.

## Layout

`ResponsiveShell` constrains width on large viewports; tab screens use `flex-1` / `min-h-0` so nested lists (e.g. FlashList) get a bounded height on web flex layouts.

## Images

- **iOS / Android:** `expo-image-picker` opens the system library (permissions are declared via the config plugin in `app.json`).
- **Web:** `pickCardImage` uses a hidden `<input type="file">` (see `src/lib/pickImage.ts`). Object URLs are revoked after a successful upload in `uploadCardImage` to avoid leaking blob URLs.

## FlashList & Reanimated

FlashList v2 and Reanimated are supported on web through React Native Web. If a list appears empty or zero-height in the browser, ensure the parent chain uses `flex-1` and `min-h-0` down to the list container.

## Supabase on web

Auth uses `localStorage` for session persistence (`src/lib/supabase.ts`). PKCE and `detectSessionInUrl` are enabled for web so email links and OAuth redirects can complete when you add those flows.
