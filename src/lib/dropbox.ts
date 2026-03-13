/**
 * Dropbox API helpers for Obsidian vault sync
 * ファイルのアップロード・ダウンロード・更新
 */

const APP_KEY    = process.env.DROPBOX_APP_KEY!
const APP_SECRET = process.env.DROPBOX_APP_SECRET!
const DROPBOX_VAULT_PATH = process.env.DROPBOX_VAULT_PATH ?? '/アプリ/remotely-save/obsidian/02_youtube/ガルちゃんねる'

async function getAccessToken(): Promise<string> {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  if (!refreshToken) throw new Error('DROPBOX_REFRESH_TOKEN が未設定です')

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: APP_KEY,
      client_secret: APP_SECRET,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error('Dropboxトークン取得失敗: ' + err)
  }
  const data = await res.json()
  return data.access_token as string
}

/** ファイルをDropboxにアップロード（上書き） */
export async function dropboxUpload(relativePath: string, content: string): Promise<void> {
  const token = await getAccessToken()
  const dropboxPath = `${DROPBOX_VAULT_PATH}/${relativePath}`

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({
        path: dropboxPath,
        mode: 'overwrite',
        autorename: false,
        mute: false,
      }),
      'Content-Type': 'application/octet-stream',
    },
    body: Buffer.from(content, 'utf-8'),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Dropboxアップロード失敗: ' + err)
  }
}

/** ファイルをDropboxからダウンロード */
export async function dropboxDownload(relativePath: string): Promise<string> {
  const token = await getAccessToken()
  const dropboxPath = `${DROPBOX_VAULT_PATH}/${relativePath}`

  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath }),
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Dropboxダウンロード失敗: ' + err)
  }
  return await res.text()
}

/** Dropboxが利用可能か確認 */
export function isDropboxAvailable(): boolean {
  return !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_REFRESH_TOKEN)
}
