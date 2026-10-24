import { bearerToken, createOmnaraClient, sdk } from '@omnara/sdk'
import { readFile } from 'node:fs/promises'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'

loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)))

if (
  !process.env.OMNARA_TOKEN?.trim() ||
  process.env.OMNARA_TOKEN.trim() === 'replace_with_your_omnara_api_token'
) {
  console.error('Replace the OMNARA_TOKEN placeholder in .env with your Omnara API token.')
  process.exit(1)
}

const source = await readFile(new URL('agent.yaml', import.meta.url), 'utf8')
if (!source.trim()) throw new Error('Add your agent configuration to agent.yaml before launching.')

const message = process.argv.slice(2).join(' ').trim() || 'Hi! What can you do?'

const result = await sdk.createAgent({
  client: createOmnaraClient({
    baseUrl: 'https://api.omnara.com/v1',
    auth: bearerToken(process.env.OMNARA_TOKEN),
  }),
  path: { orgID: 'org_vc7l6n4ix2hhbny7x6xvbfey5e', projectID: 'proj_agqw7dscfn7kld6dcv2re2dnxe' },
  body: {
    config_source: { source, source_format: 'yaml' },
    name: 'Machine assistant',
    message,
  },
})

console.log('Agent created. Open this chat to view the reply:')
console.log(`https://app.omnara.com/projects/proj_agqw7dscfn7kld6dcv2re2dnxe/agents/${result.data.agent.id}/chat`)
