# Maze and Labyrinth Generator

A client-side React, TypeScript, and Vite application for generating, validating, inspecting, exporting, and sharing physically scaled mazes and labyrinths.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
```

## Deployment

Create a static production build with `npm run build`. Deploy the generated `dist/` directory through a static host or iframe embedding. Core functionality requires no backend.

## Supported browsers

Target current stable releases of Chrome, Firefox, and Edge.

## Implementation planning

The implementation change is tracked in `openspec/changes/implement-labyrinth-software-v1/`. Requirements are derived from `storyDetails.md`.
