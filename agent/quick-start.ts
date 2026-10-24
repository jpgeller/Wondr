// npm install @omnara/sdk
import { createOmnaraClient, bearerToken, sdk } from '@omnara/sdk'

const token = process.env.OMNARA_TOKEN
if (!token) throw new Error('Set OMNARA_TOKEN')

const client = createOmnaraClient({
  baseUrl: 'https://api.omnara.com/v1',
  auth: bearerToken(token),
})

const me = await sdk.getCurrentUser({ client })
const orgID = me.data.orgs[0].id

const projects = await sdk.listVisibleProjects({
  client,
  path: { orgID },
  query: { limit: 1 },
})
const projectID = projects.data.data[0].id