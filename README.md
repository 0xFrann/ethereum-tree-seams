# Ethereum Annual Rings

An accessible annual-rings visualization of Ethereum market history.

## Development

Use Node 22.13 or newer, then install dependencies and run the quality suite:

```sh
npm install
npm run test:all
```

`npm run dev` starts the local Next.js server. The visitor API serves only the private
cache; scheduled refreshes are performed by the protected refresh route.

## Quality gates

`npm run test:all` checks formatting, JavaScript and CSS linting, strict TypeScript,
focused unit/integration contracts, and the production build. CI additionally runs
Knip, the dependency audit, and Conventional Commit validation.
