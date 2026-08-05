import { useMemo } from 'react'
import { Box, IconButton, Stack } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { AgGridReact } from 'ag-grid-react'
import type { CustomCellRendererProps } from 'ag-grid-react'
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
} from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'

import type { StockPredictionRow } from '../../apis/stockPredictionApi'

ModuleRegistry.registerModules([AllCommunityModule])

export type StockPredictionGridRow = StockPredictionRow & { draftKey?: string }

export function isDraftGridRow(row: StockPredictionGridRow | undefined): boolean {
  return Boolean(row?.draftKey)
}

export type StockPredictionGridContext = {
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, row: StockPredictionRow) => void
  onSaveDraft: (row: StockPredictionGridRow) => void
  onCancelDraft: (row: StockPredictionGridRow) => void
}

function formatDateCell(s: string | null) {
  return s?.slice(0, 10) ?? ''
}

function formatNumberCell(v: number | null | undefined) {
  if (v == null) return '-'
  return v.toLocaleString()
}

function MenuCell(
  props: CustomCellRendererProps<StockPredictionGridRow, unknown, StockPredictionGridContext>,
) {
  const row = props.data
  if (!row) return null
  if (isDraftGridRow(row)) {
    return (
      <Stack direction="row" spacing={0.25} justifyContent="center" alignItems="center" width="100%">
        <IconButton
          size="small"
          color="primary"
          onClick={() => props.context?.onSaveDraft(row)}
          aria-label="저장"
        >
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => props.context?.onCancelDraft(row)}
          aria-label="행 취소"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    )
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <IconButton
        size="small"
        onClick={(e) => props.context?.onOpenMenu(e, row)}
        aria-label="행 메뉴"
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

const defaultColDef: ColDef<StockPredictionGridRow> = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
  editable: (p) => isDraftGridRow(p.data),
}

type Props = {
  rows: StockPredictionGridRow[]
  context: StockPredictionGridContext
  onCellValueChanged: (e: CellValueChangedEvent<StockPredictionGridRow>) => void
  height?: number
}

export default function StockPredictionAgGrid({
  rows,
  context,
  onCellValueChanged,
  height = 480,
}: Props) {
  const columnDefs = useMemo<ColDef<StockPredictionGridRow>[]>(
    () => [
      {
        field: 'stPrdId',
        headerName: 'NO',
        width: 88,
        maxWidth: 120,
        filter: 'agNumberColumnFilter',
        editable: false,
        valueFormatter: (p) => (isDraftGridRow(p.data) ? '—' : String(p.value ?? '')),
      },
      {
        field: 'stockCode',
        headerName: '종목코드',
        width: 110,
        maxWidth: 140,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'stockName',
        headerName: '종목명',
        minWidth: 120,
        maxWidth: 160,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'wrDate',
        headerName: '작성일',
        width: 120,
        editable: true,
        valueFormatter: (p) =>
          isDraftGridRow(p.data) ? String(p.value ?? '') : formatDateCell(p.value as string | null),
      },
      {
        field: 'wrTime',
        headerName: '시간',
        width: 80,
        maxWidth: 100,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'stockPrice',
        headerName: '주가',
        width: 100,
        filter: 'agNumberColumnFilter',
        editable: true,
        valueParser: (p) => {
          const n = Number(String(p.newValue).replace(/,/g, ''))
          return Number.isFinite(n) ? n : null
        },
        valueFormatter: (p) =>
          isDraftGridRow(p.data) ? String(p.value ?? '') : formatNumberCell(p.value as number | null),
      },
      {
        field: 'perPrice',
        headerName: 'PER',
        width: 88,
        filter: 'agNumberColumnFilter',
        editable: true,
        valueParser: (p) => {
          const n = Number(String(p.newValue).replace(/,/g, ''))
          return Number.isFinite(n) ? n : null
        },
        valueFormatter: (p) =>
          isDraftGridRow(p.data) ? String(p.value ?? '') : formatNumberCell(p.value as number | null),
      },
      {
        field: 'prediction',
        headerName: '예측',
        width: 100,
        maxWidth: 120,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'createdAt',
        headerName: '등록일',
        width: 120,
        editable: false,
        valueFormatter: (p) =>
          isDraftGridRow(p.data) ? '—' : formatDateCell(String(p.value ?? '')),
      },
      {
        colId: 'menu',
        headerName: '메뉴',
        width: 112,
        maxWidth: 120,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: MenuCell,
      },
    ],
    [],
  )

  return (
    <Box
      className="ag-theme-alpine"
      sx={{
        width: '100%',
        height,
        minHeight: 280,
        '& .ag-header-cell-label': { justifyContent: 'center' },
        '& .ag-cell': { display: 'flex', alignItems: 'center' },
        '& .ag-cell[col-id="stockName"]': { justifyContent: 'flex-start', fontWeight: 500 },
        '& .ag-cell[col-id="menu"]': { justifyContent: 'center' },
        '& .ag-row-pinned .ag-cell': { fontStyle: 'normal' },
      }}
    >
      <AgGridReact<StockPredictionGridRow>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => (p.data.draftKey ? p.data.draftKey : String(p.data.stPrdId))}
        domLayout="normal"
        rowHeight={42}
        headerHeight={40}
        animateRows
        stopEditingWhenCellsLoseFocus
        onCellValueChanged={onCellValueChanged}
      />
    </Box>
  )
}
