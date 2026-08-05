import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TableChartIcon from '@mui/icons-material/TableChart'
import CodeIcon from '@mui/icons-material/Code'
import ArticleIcon from '@mui/icons-material/Article'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import SearchIcon from '@mui/icons-material/Search'
import StorageIcon from '@mui/icons-material/Storage'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DnsIcon from '@mui/icons-material/Dns'
import ComputerIcon from '@mui/icons-material/Computer'
import {
  createDbHostApi,
  deleteDbHostApi,
  fetchDbHostsApi,
  testDbHostApi,
  updateDbHostApi,
  type DbHost,
  type DbHostPayload,
} from '../../apis/dbHostApi'
import {
  alterDbColumnApi,
  columnTypeLabel,
  executeDbQueryApi,
  fetchDbColumnsApi,
  fetchDbSchemasApi,
  fetchDbTableDdlApi,
  fetchDbTableRowsApi,
  fetchDbTablesApi,
  formatBytes,
  type DbColumn,
  type DbConnId,
  type DbQueryResult,
  type DbTable,
} from '../../apis/dbManagerApi'

const LOCAL_DB_LABEL = '로컬 DB (Docker)'

const EMPTY_DB_FORM: DbHostPayload = {
  label: '',
  host: '',
  port: 5432,
  db_name: 'psjdb',
  db_user: 'psj',
  db_password: '',
  sort_no: 0,
}

type MainTab = 'data' | 'structure' | 'ddl' | 'sql'

function cellText(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ResultTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: Record<string, unknown>[]
}) {
  if (columns.length === 0) return null
  return (
    <TableContainer sx={{ maxHeight: 'calc(100vh - 340px)', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col} sx={{ fontWeight: 600, whiteSpace: 'nowrap', bgcolor: 'grey.50' }}>
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                결과가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow key={idx} hover>
                {columns.map((col) => (
                  <TableCell
                    key={col}
                    sx={{
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: row[col] == null ? 'text.disabled' : 'text.primary',
                    }}
                    title={cellText(row[col])}
                  >
                    {cellText(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function DbManagerPage() {
  const [selectedConnId, setSelectedConnId] = useState<DbConnId>(null)
  const [dbHosts, setDbHosts] = useState<DbHost[]>([])
  const [manageOpen, setManageOpen] = useState(false)
  const [editingDbHost, setEditingDbHost] = useState<DbHost | null>(null)
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none')
  const [dbForm, setDbForm] = useState<DbHostPayload>({ ...EMPTY_DB_FORM })
  const [formError, setFormError] = useState<string | null>(null)

  const [schemas, setSchemas] = useState<string[]>([])
  const [schema, setSchema] = useState('public')
  const [tables, setTables] = useState<DbTable[]>([])
  const [tableFilter, setTableFilter] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<MainTab>('data')

  const [columns, setColumns] = useState<DbColumn[]>([])
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([])
  const [rowColumns, setRowColumns] = useState<string[]>([])
  const [rowTotal, setRowTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const [sql, setSql] = useState('SELECT 1;')
  const [queryResult, setQueryResult] = useState<DbQueryResult | null>(null)
  const [ddlScript, setDdlScript] = useState('')

  const [loadingSchemas, setLoadingSchemas] = useState(false)
  const [loadingTables, setLoadingTables] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [loadingDdl, setLoadingDdl] = useState(false)
  const [executingSql, setExecutingSql] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedColumn, setSelectedColumn] = useState<DbColumn | null>(null)
  const [editColumnName, setEditColumnName] = useState('')
  const [editColumnType, setEditColumnType] = useState('')
  const [editColumnComment, setEditColumnComment] = useState('')
  const [savingColumn, setSavingColumn] = useState(false)

  const filteredTables = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    if (!q) return tables
    return tables.filter((t) => t.name.toLowerCase().includes(q))
  }, [tables, tableFilter])

  const selectedConnLabel = useMemo(() => {
    if (selectedConnId == null) return LOCAL_DB_LABEL
    return dbHosts.find((h) => h.id === selectedConnId)?.label || `DB #${selectedConnId}`
  }, [selectedConnId, dbHosts])

  const loadDbHosts = useCallback(async () => {
    try {
      const list = await fetchDbHostsApi()
      setDbHosts(list)
    } catch {
      // 무시
    }
  }, [])

  const loadSchemas = useCallback(async () => {
    setLoadingSchemas(true)
    try {
      const list = await fetchDbSchemasApi(selectedConnId)
      const names = list.map((s) => s.name)
      setSchemas(names)
      setSchema((prev) => {
        if (names.includes(prev)) return prev
        return names.includes('public') ? 'public' : names[0] || 'public'
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '스키마 조회 실패')
    } finally {
      setLoadingSchemas(false)
    }
  }, [selectedConnId])

  const loadTables = useCallback(async () => {
    setLoadingTables(true)
    setError(null)
    try {
      const list = await fetchDbTablesApi(schema, selectedConnId)
      setTables(list)
      setSelectedTable((prev) => (prev && list.some((t) => t.name === prev) ? prev : null))
    } catch (e) {
      setError(e instanceof Error ? e.message : '테이블 목록 조회 실패')
    } finally {
      setLoadingTables(false)
    }
  }, [schema, selectedConnId])

  const loadTableData = useCallback(async () => {
    if (!selectedTable) return
    setLoadingData(true)
    setError(null)
    try {
      const [cols, rows] = await Promise.all([
        fetchDbColumnsApi(selectedTable, schema, selectedConnId),
        fetchDbTableRowsApi(selectedTable, {
          schema,
          connId: selectedConnId,
          limit: rowsPerPage,
          offset: page * rowsPerPage,
        }),
      ])
      setColumns(cols)
      setRowColumns(rows.columns)
      setTableRows(rows.rows)
      setRowTotal(rows.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 조회 실패')
    } finally {
      setLoadingData(false)
    }
  }, [selectedTable, schema, page, rowsPerPage, selectedConnId])

  const loadTableDdl = useCallback(async () => {
    if (!selectedTable) return
    setLoadingDdl(true)
    setError(null)
    try {
      const result = await fetchDbTableDdlApi(selectedTable, schema, selectedConnId)
      setDdlScript(result.ddl)
    } catch (e) {
      setDdlScript('')
      setError(e instanceof Error ? e.message : 'DDL 조회 실패')
    } finally {
      setLoadingDdl(false)
    }
  }, [selectedTable, schema, selectedConnId])

  useEffect(() => {
    loadDbHosts()
  }, [loadDbHosts])

  useEffect(() => {
    loadSchemas()
  }, [loadSchemas])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  useEffect(() => {
    if (selectedTable && (mainTab === 'data' || mainTab === 'structure')) {
      loadTableData()
    }
  }, [selectedTable, mainTab, loadTableData])

  useEffect(() => {
    if (selectedTable && mainTab === 'ddl') {
      loadTableDdl()
    }
  }, [selectedTable, mainTab, loadTableDdl])

  const handleSelectTable = (name: string) => {
    setSelectedTable(name)
    setMainTab('data')
    setPage(0)
    setSelectedColumn(null)
    setSql(`SELECT * FROM "${schema}"."${name}" LIMIT 100;`)
  }

  const handleSelectColumn = (col: DbColumn) => {
    setSelectedColumn(col)
    setEditColumnName(col.name)
    setEditColumnType(columnTypeLabel(col))
    setEditColumnComment(col.comment ?? '')
  }

  const handleSaveColumn = async () => {
    if (!selectedTable || !selectedColumn) return
    const newName = editColumnName.trim()
    const newType = editColumnType.trim()
    const currentType = columnTypeLabel(selectedColumn)

    if (!newName) {
      setError('컬럼명을 입력하세요.')
      return
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newName)) {
      setError('컬럼명은 영문, 숫자, 밑줄만 사용할 수 있으며 숫자로 시작할 수 없습니다.')
      return
    }
    if (!newType) {
      setError('데이터 타입을 입력하세요.')
      return
    }

    const payload: { new_name?: string; new_type?: string; new_comment?: string } = {}
    if (newName !== selectedColumn.name) payload.new_name = newName
    if (newType !== currentType) payload.new_type = newType
    const currentComment = selectedColumn.comment ?? ''
    if (editColumnComment !== currentComment) payload.new_comment = editColumnComment

    if (!payload.new_name && !payload.new_type && payload.new_comment === undefined) return

    setSavingColumn(true)
    setError(null)
    try {
      const result = await alterDbColumnApi(selectedTable, selectedColumn.name, payload, schema, selectedConnId)
      const [cols, rows] = await Promise.all([
        fetchDbColumnsApi(selectedTable, schema, selectedConnId),
        fetchDbTableRowsApi(selectedTable, {
          schema,
          connId: selectedConnId,
          limit: rowsPerPage,
          offset: page * rowsPerPage,
        }),
      ])
      setColumns(cols)
      setRowColumns(rows.columns)
      setTableRows(rows.rows)
      setRowTotal(rows.total)
      const updated = cols.find((c) => c.name === result.column)
      if (updated) {
        handleSelectColumn(updated)
      } else {
        setSelectedColumn(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '컬럼 수정 실패')
    } finally {
      setSavingColumn(false)
    }
  }

  const handleExecuteSql = async () => {
    setExecutingSql(true)
    setError(null)
    setQueryResult(null)
    try {
      const result = await executeDbQueryApi(sql, selectedConnId)
      setQueryResult(result)
      setMainTab('sql')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'SQL 실행 실패')
    } finally {
      setExecutingSql(false)
    }
  }

  const handleRefresh = () => {
    loadSchemas()
    loadTables()
    if (selectedTable) {
      loadTableData()
      if (mainTab === 'ddl') loadTableDdl()
    }
  }

  const handleConnChange = (connId: DbConnId) => {
    setSelectedConnId(connId)
    setSelectedTable(null)
    setSelectedColumn(null)
    setPage(0)
    setQueryResult(null)
    setDdlScript('')
  }

  const openCreateDbHost = () => {
    setEditingDbHost(null)
    setFormMode('create')
    setDbForm({ ...EMPTY_DB_FORM })
    setFormError(null)
    setManageOpen(true)
  }

  const openEditDbHost = (h: DbHost) => {
    setEditingDbHost(h)
    setFormMode('edit')
    setDbForm({
      label: h.label,
      host: h.host,
      port: h.port,
      db_name: h.db_name,
      db_user: h.db_user,
      db_password: h.db_password || '',
      sort_no: h.sort_no,
    })
    setFormError(null)
    setManageOpen(true)
  }

  const handleSaveDbHost = async () => {
    if (!dbForm.label.trim() || !dbForm.host.trim() || !dbForm.db_name.trim() || !dbForm.db_user.trim()) {
      setFormError('별칭, 호스트, DB명, 사용자명은 필수입니다.')
      return
    }
    try {
      if (editingDbHost) {
        await updateDbHostApi(editingDbHost.id, dbForm)
      } else {
        await createDbHostApi(dbForm)
      }
      setFormMode('none')
      setEditingDbHost(null)
      setDbForm({ ...EMPTY_DB_FORM })
      loadDbHosts()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const handleDeleteDbHost = async (id: number) => {
    if (!confirm('이 DB 연결을 삭제하시겠습니까?')) return
    try {
      await deleteDbHostApi(id)
      if (selectedConnId === id) handleConnChange(null)
      loadDbHosts()
    } catch {
      // 무시
    }
  }

  const handleTestDbHost = async (id: number) => {
    try {
      const res = await testDbHostApi(id)
      setError(null)
      alert(res.message)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '연결 테스트 실패')
    }
  }

  const handleCopyDdl = async () => {
    if (!ddlScript) return
    try {
      await navigator.clipboard.writeText(ddlScript)
    } catch {
      setError('클립보드 복사에 실패했습니다.')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, overflow: 'hidden', p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <StorageIcon color="primary" />
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              DB 관리
            </Typography>
            <Chip label={selectedConnLabel} size="small" color="primary" variant="outlined" />
            <Chip label="PostgreSQL" size="small" variant="outlined" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="conn-select-label">접속 서버</InputLabel>
              <Select
                labelId="conn-select-label"
                value={selectedConnId != null ? String(selectedConnId) : ''}
                input={<OutlinedInput label="접속 서버" />}
                onChange={(e) => {
                  const v = e.target.value
                  handleConnChange(v === '' ? null : Number(v))
                }}
              >
                <MenuItem value="">
                  <Stack direction="row" alignItems="center" component="span">
                    <ComputerIcon sx={{ mr: 1, fontSize: 18 }} />
                    {LOCAL_DB_LABEL}
                  </Stack>
                </MenuItem>
                {dbHosts.map((h) => (
                  <MenuItem key={h.id} value={String(h.id)}>
                    <DnsIcon sx={{ mr: 1, fontSize: 18 }} />
                    {h.label}
                    <Chip
                      label={`${h.db_user}@${h.host}:${h.port}/${h.db_name}`}
                      size="small"
                      sx={{ ml: 1, height: 20, fontSize: 11 }}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="DB 연결 관리">
              <IconButton onClick={() => setManageOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="schema-select-label">스키마</InputLabel>
              <Select
                labelId="schema-select-label"
                value={schema}
                label="스키마"
                onChange={(e) => {
                  setSchema(e.target.value)
                  setSelectedTable(null)
                  setSelectedColumn(null)
                  setPage(0)
                }}
                disabled={loadingSchemas}
              >
                {schemas.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="새로고침">
              <IconButton onClick={handleRefresh} disabled={loadingTables || loadingData}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 2 }}>
          {/* 좌측: 테이블 목록 */}
          <Paper
            variant="outlined"
            sx={{
              width: 260,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              borderRadius: 2,
            }}
          >
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                테이블
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="테이블 검색"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              {loadingTables ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <List dense disablePadding>
                  {filteredTables.map((t) => (
                    <ListItemButton
                      key={t.name}
                      selected={selectedTable === t.name}
                      onClick={() => handleSelectTable(t.name)}
                      sx={{ py: 0.75 }}
                    >
                      <TableChartIcon sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                      <ListItemText
                        primary={t.name}
                        secondary={`~${t.approx_rows.toLocaleString()}행 · ${formatBytes(t.size_bytes)}`}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: selectedTable === t.name ? 600 : 400 }}
                        secondaryTypographyProps={{ fontSize: 11 }}
                      />
                    </ListItemButton>
                  ))}
                  {filteredTables.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                      테이블이 없습니다.
                    </Typography>
                  )}
                </List>
              )}
            </Box>
          </Paper>

          {/* 우측: 데이터 / 구조 / SQL */}
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              minHeight: 0,
            }}
          >
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
              <Tabs
                value={mainTab}
                onChange={(_, v: MainTab) => setMainTab(v)}
                sx={{ minHeight: 44 }}
              >
                <Tab
                  value="data"
                  label="데이터"
                  icon={<TableChartIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 44 }}
                  disabled={!selectedTable}
                />
                <Tab
                  value="structure"
                  label="구조"
                  icon={<StorageIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 44 }}
                  disabled={!selectedTable}
                />
                <Tab
                  value="ddl"
                  label="DDL"
                  icon={<ArticleIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 44 }}
                  disabled={!selectedTable}
                />
                <Tab
                  value="sql"
                  label="SQL"
                  icon={<CodeIcon fontSize="small" />}
                  iconPosition="start"
                  sx={{ minHeight: 44 }}
                />
              </Tabs>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
              {mainTab === 'data' && (
                <>
                  {selectedTable ? (
                    <>
                      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                        {schema}.{selectedTable}
                        <Chip label={`총 ${rowTotal.toLocaleString()}행`} size="small" sx={{ ml: 1 }} />
                      </Typography>
                      {loadingData ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                          <CircularProgress />
                        </Box>
                      ) : (
                        <>
                          <ResultTable columns={rowColumns} rows={tableRows} />
                          <TablePagination
                            component="div"
                            count={rowTotal}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => {
                              setRowsPerPage(parseInt(e.target.value, 10))
                              setPage(0)
                            }}
                            rowsPerPageOptions={[25, 50, 100, 200]}
                            labelRowsPerPage="페이지당 행"
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      왼쪽에서 테이블을 선택하세요.
                    </Typography>
                  )}
                </>
              )}

              {mainTab === 'structure' && (
                <>
                  {selectedTable ? (
                    loadingData ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                      </Box>
                    ) : (
                      <Stack spacing={2}>
                        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>컬럼</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>타입</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>NULL</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>기본값</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>코멘트</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {columns.map((col) => (
                                <TableRow
                                  key={col.name}
                                  hover
                                  selected={selectedColumn?.name === col.name}
                                  onClick={() => handleSelectColumn(col)}
                                  sx={{ cursor: 'pointer' }}
                                >
                                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{col.name}</TableCell>
                                  <TableCell sx={{ fontSize: 13 }}>
                                    {columnTypeLabel(col)}
                                  </TableCell>
                                  <TableCell>{col.nullable ? 'YES' : 'NO'}</TableCell>
                                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {col.default ?? '-'}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }} title={col.comment ?? ''}>
                                    {col.comment || '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {selectedColumn && (
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                              컬럼 수정
                            </Typography>
                            <Stack spacing={1.5}>
                              <TextField
                                label="컬럼명"
                                size="small"
                                value={editColumnName}
                                onChange={(e) => setEditColumnName(e.target.value)}
                                inputProps={{ style: { fontFamily: 'monospace' } }}
                                fullWidth
                              />
                              <TextField
                                label="데이터 타입"
                                size="small"
                                value={editColumnType}
                                onChange={(e) => setEditColumnType(e.target.value)}
                                placeholder="예: varchar(255), integer, text, boolean"
                                helperText="PostgreSQL 타입 (예: integer, varchar(100), timestamp, jsonb)"
                                inputProps={{ style: { fontFamily: 'monospace' } }}
                                fullWidth
                              />
                              <TextField
                                label="코멘트"
                                size="small"
                                value={editColumnComment}
                                onChange={(e) => setEditColumnComment(e.target.value)}
                                placeholder="컬럼 설명"
                                helperText="비우면 삭제됩니다."
                                fullWidth
                              />
                              <Stack direction="row" spacing={1}>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={() => void handleSaveColumn()}
                                  disabled={savingColumn}
                                  startIcon={savingColumn ? <CircularProgress size={14} color="inherit" /> : undefined}
                                >
                                  저장
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => setSelectedColumn(null)}
                                  disabled={savingColumn}
                                >
                                  취소
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        )}
                      </Stack>
                    )
                  ) : (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      왼쪽에서 테이블을 선택하세요.
                    </Typography>
                  )}
                </>
              )}

              {mainTab === 'ddl' && (
                <>
                  {selectedTable ? (
                    loadingDdl ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress />
                      </Box>
                    ) : (
                      <Stack spacing={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="subtitle2">
                            {schema}.{selectedTable} 생성 스크립트
                          </Typography>
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => void handleCopyDdl()}
                            disabled={!ddlScript}
                          >
                            복사
                          </Button>
                        </Stack>
                        <TextField
                          multiline
                          fullWidth
                          minRows={16}
                          maxRows={32}
                          value={ddlScript}
                          InputProps={{ readOnly: true }}
                          sx={{
                            '& textarea': {
                              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                              fontSize: 13,
                              lineHeight: 1.5,
                            },
                          }}
                        />
                      </Stack>
                    )
                  ) : (
                    <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      왼쪽에서 테이블을 선택하세요.
                    </Typography>
                  )}
                </>
              )}

              {mainTab === 'sql' && (
                <Stack spacing={2}>
                  <TextField
                    multiline
                    minRows={6}
                    maxRows={14}
                    fullWidth
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    placeholder="SELECT * FROM ..."
                    sx={{
                      '& textarea': { fontFamily: 'Menlo, Monaco, "Courier New", monospace', fontSize: 13 },
                    }}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault()
                        void handleExecuteSql()
                      }
                    }}
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Button
                      variant="contained"
                      startIcon={executingSql ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                      onClick={() => void handleExecuteSql()}
                      disabled={executingSql || !sql.trim()}
                    >
                      실행
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      Ctrl+Enter 로 실행
                    </Typography>
                  </Stack>
                  <Divider />
                  {queryResult?.message && (
                    <Alert severity="success">{queryResult.message}</Alert>
                  )}
                  {queryResult && queryResult.columns.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary">
                        {queryResult.row_count.toLocaleString()}행 반환
                      </Typography>
                      <ResultTable columns={queryResult.columns} rows={queryResult.rows} />
                    </>
                  )}
                </Stack>
              )}
            </Box>
          </Paper>
        </Box>
      </Paper>

      <Dialog
        open={manageOpen}
        onClose={() => { setManageOpen(false); setFormMode('none') }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          DB 연결 관리
          <Button size="small" startIcon={<AddIcon />} onClick={openCreateDbHost}>
            추가
          </Button>
        </DialogTitle>
        <DialogContent dividers>
          {dbHosts.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              등록된 DB 연결이 없습니다. &quot;추가&quot; 버튼으로 등록하세요.
            </Typography>
          ) : (
            <Stack spacing={0} divider={<Divider />}>
              {dbHosts.map((h) => (
                <Stack key={h.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
                  <Button
                    size="small"
                    variant={selectedConnId === h.id ? 'contained' : 'outlined'}
                    onClick={() => {
                      handleConnChange(h.id)
                      setManageOpen(false)
                    }}
                    sx={{ minWidth: 72, flexShrink: 0 }}
                  >
                    접속
                  </Button>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flexShrink: 0 }}>
                    {h.label}
                  </Typography>
                  <Chip
                    label={`${h.db_user}@${h.host}:${h.port}/${h.db_name}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11, maxWidth: 240 }}
                  />
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" onClick={() => void handleTestDbHost(h.id)}>
                    테스트
                  </Button>
                  <IconButton size="small" onClick={() => openEditDbHost(h)} aria-label="수정">
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => void handleDeleteDbHost(h.id)} aria-label="삭제">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}

          {formMode !== 'none' && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                {editingDbHost ? 'DB 연결 수정' : '새 DB 연결 등록'}
              </Typography>
              <Stack spacing={1.5}>
                <TextField
                  label="별칭"
                  size="small"
                  value={dbForm.label}
                  onChange={(e) => setDbForm({ ...dbForm, label: e.target.value })}
                  placeholder="예: 운영 DB"
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="호스트"
                    size="small"
                    value={dbForm.host}
                    onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })}
                    placeholder="192.168.0.10"
                    sx={{ flex: 2 }}
                  />
                  <TextField
                    label="포트"
                    size="small"
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => setDbForm({ ...dbForm, port: Number(e.target.value) })}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <TextField
                  label="데이터베이스명"
                  size="small"
                  value={dbForm.db_name}
                  onChange={(e) => setDbForm({ ...dbForm, db_name: e.target.value })}
                  fullWidth
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="사용자명"
                    size="small"
                    value={dbForm.db_user}
                    onChange={(e) => setDbForm({ ...dbForm, db_user: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="패스워드"
                    size="small"
                    type="password"
                    value={dbForm.db_password}
                    onChange={(e) => setDbForm({ ...dbForm, db_password: e.target.value })}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <TextField
                  label="정렬순서"
                  size="small"
                  type="number"
                  value={dbForm.sort_no}
                  onChange={(e) => setDbForm({ ...dbForm, sort_no: Number(e.target.value) })}
                  sx={{ width: 120 }}
                />
              </Stack>
              {formError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {formError}
                </Alert>
              )}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {formMode !== 'none' && (
            <>
              <Button
                onClick={() => {
                  setFormMode('none')
                  setEditingDbHost(null)
                  setDbForm({ ...EMPTY_DB_FORM })
                  setFormError(null)
                }}
              >
                취소
              </Button>
              <Button variant="contained" onClick={() => void handleSaveDbHost()}>
                {editingDbHost ? '수정' : '등록'}
              </Button>
            </>
          )}
          <Button onClick={() => { setManageOpen(false); setFormMode('none') }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
