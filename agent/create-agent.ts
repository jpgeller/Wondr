import { bearerToken, createOmnaraClient, sdk } from '@omnara/sdk'
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

const result = await sdk.createAgent({
  client: createOmnaraClient({
    baseUrl: 'https://api.omnara.com/v1',
    auth: bearerToken(process.env.OMNARA_TOKEN),
  }),
  path: { orgID: 'org_vc7l6n4ix2hhbny7x6xvbfey5e', projectID: 'proj_agqw7dscfn7kld6dcv2re2dnxe' },
  body: {
    profile: 'aprf_agqw7fihi53utbdfw2yqgsirzm',
    config: 'acfg_agqw7fig5fyifi37utoh3lh2t4',
    message: 'Hi! What can you do?',
  },
})

console.log('Agent created. Open this chat to view the reply:')
console.log(`https://app.omnara.com/projects/proj_agqw7dscfn7kld6dcv2re2dnxe/agents/${result.data.agent.id}/chat`)
