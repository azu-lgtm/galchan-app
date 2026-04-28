// 自ガル9台本スプシの共有設定を「リンクを知ってる人は閲覧可能」に変更
import { google } from 'googleapis'
import fs from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
  if (m && !line.trim().startsWith('#')) {
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    process.env[m[1]] = val
  }
}

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
const drive = google.drive({ version: 'v3', auth })

const fileId = '1vzAeBpDJXOBzKyNhiBWA1xEcVA1vPGOLZZNtNehTgNg'

// 現状の共有設定確認
const before = await drive.permissions.list({ fileId, fields: 'permissions(id,type,role,emailAddress,domain)' })
console.log('変更前の permissions:')
before.data.permissions?.forEach(p => console.log(` - type=${p.type} role=${p.role} ${p.emailAddress || p.domain || ''}`))

// anyoneWithLink で reader 権限を追加
const res = await drive.permissions.create({
  fileId,
  requestBody: {
    type: 'anyone',
    role: 'reader',
    allowFileDiscovery: false, // 検索で見つからない・リンクだけ
  },
  fields: 'id',
})
console.log('\n✅ anyone (link) reader 追加:', res.data.id)

// 変更後
const after = await drive.permissions.list({ fileId, fields: 'permissions(id,type,role,emailAddress,domain,allowFileDiscovery)' })
console.log('\n変更後の permissions:')
after.data.permissions?.forEach(p => console.log(` - type=${p.type} role=${p.role} ${p.emailAddress || p.domain || ''} discovery=${p.allowFileDiscovery ?? 'n/a'}`))
