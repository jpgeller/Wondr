# Wondr

A spontaneous day planner. See [build-plan.md](build-plan.md) for the product,
team responsibilities, and shared input/output contract.

The working Omnara starter and teammate #2's next steps are in
[agent/README.md](agent/README.md). It has its own package files so the Next.js
app can be built at the repo root independently.

```sh
cd agent
npm install
npm start
```

Set `OMNARA_TOKEN` in `agent/.env` before starting. Each run creates a new chat.
