const BASE = '/api'

export interface DiskUsage {
  path: string
  total: number
  used: number
  free: number
  used_percent: number
  error?: string
}

export interface MemoryUsage {
  total: number
  used: number
  free: number
  used_percent: number
  error?: string
}

export interface ServerStatusResponse {
  ping_ok: boolean
  disk: DiskUsage
  memory: MemoryUsage
  cpu?: CpuUsage
}

export async function fetchServerStatusApi(): Promise<ServerStatusResponse> {
  const response = await fetch(`${BASE}/server/status`)
  if (!response.ok) throw new Error('Failed to fetch server status')
  return response.json()
}

export interface CpuUsage {
  used_percent: number
  error?: string
}

export async function fetchCpuUsageApi(): Promise<CpuUsage> {
  const cpuRes = await fetch(`${BASE}/server/cpu`).catch(() => null)
  if (cpuRes?.ok) return cpuRes.json()
  const statusRes = await fetch(`${BASE}/server/status`)
  if (statusRes.ok) {
    const data = await statusRes.json()
    if (data.cpu && !data.cpu.error) return data.cpu
  }
  throw new Error('CPU 조회 실패')
}

export async function fetchMemoryUsageApi(): Promise<MemoryUsage> {
  const memRes = await fetch(`${BASE}/server/memory`).catch(() => null)
  if (memRes?.ok) return memRes.json()
  const statusRes = await fetch(`${BASE}/server/status`)
  if (statusRes.ok) {
    const data = await statusRes.json()
    if (data.memory && !data.memory.error) return data.memory
  }
  throw new Error('메모리 조회 실패')
}

export async function fetchDiskUsageApi(path = '/'): Promise<DiskUsage> {
  const url = `${BASE}/server/disk?path=${encodeURIComponent(path)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to fetch disk usage')
  return response.json()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
