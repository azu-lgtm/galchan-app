import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAuth } from '@/lib/youtube-analytics'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  try {
    const auth = getAuth()
    const { token } = await auth.getAccessToken()
    if (!token) {
      return NextResponse.json({ error: 'アクセストークン取得失敗' }, { status: 401 })
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }

    // 既存ジョブを確認
    const listRes = await fetch('https://youtubereporting.googleapis.com/v1/jobs', { headers })
    if (!listRes.ok) {
      const err = await listRes.json()
      return NextResponse.json({ error: 'ジョブ一覧取得失敗', detail: err }, { status: listRes.status })
    }
    const listData = await listRes.json()
    const existingJob = (listData.jobs ?? []).find(
      (j: { reportTypeId: string }) => j.reportTypeId === 'channel_reach_basic_a1'
    )

    if (existingJob) {
      return NextResponse.json({
        message: '既にジョブが存在します',
        jobId: existingJob.id,
        reportTypeId: existingJob.reportTypeId,
        createTime: existingJob.createTime,
      })
    }

    // 新規ジョブ作成
    const createRes = await fetch('https://youtubereporting.googleapis.com/v1/jobs', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        reportTypeId: 'channel_reach_basic_a1',
        name: 'Galchan Channel Reach Report',
      }),
    })

    if (!createRes.ok) {
      const err = await createRes.json()
      return NextResponse.json({ error: 'ジョブ作成失敗', detail: err }, { status: createRes.status })
    }

    const job = await createRes.json()
    return NextResponse.json({
      message: 'ジョブを作成しました。レポートは1〜2日後から利用可能です。',
      jobId: job.id,
      reportTypeId: job.reportTypeId,
      createTime: job.createTime,
    })
  } catch (e) {
    console.error('reporting-setup error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ジョブ作成に失敗しました' },
      { status: 500 }
    )
  }
}
