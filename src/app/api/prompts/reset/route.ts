import { NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { resetPromptsToDefault } from '@/lib/kv'

export async function POST() {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const prompts = await resetPromptsToDefault()
  return NextResponse.json({ success: true, prompts })
}
