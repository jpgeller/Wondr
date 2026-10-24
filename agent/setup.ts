import { createOmnaraClient, bearerToken, sdk } from '@omnara/sdk'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)))

const token = process.env.OMNARA_TOKEN?.trim()
if (!token || token === 'replace_with_your_omnara_api_token') {
  throw new Error('Set OMNARA_TOKEN in agent/.env to your Omnara personal token.')
}

const client = createOmnaraClient({
  baseUrl: 'https://api.omnara.com/v1',
  auth: bearerToken(token),
})

const me = await sdk.getCurrentUser({ client })
const orgID = me.data.orgs[0]?.id
if (!orgID) throw new Error('No organization is available for this account.')

const projects = await sdk.listVisibleProjects({
  client,
  path: { orgID },
  query: { limit: 1 },
})
const projectID = projects.data.data[0]?.id
if (!projectID) throw new Error('No project is available in this organization.')

console.log('Setup check succeeded:')
console.log({ orgID, projectID })
