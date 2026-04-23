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

import type { PaidInfoRow } from '../../apis/paidInfoApi'

ModuleRegistry.registerModules([AllCommunityModule])

export type PaidInfoGridRow = PaidInfoRow & { draftKey?: string }

export function isDraftPaidGridRow(row: PaidInfoGridRow | undefined): boolean {
  return Boolean(row?.draftKey)
}

export type PaidInfoGridContext = {
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, row: PaidInfoRow) => void
  onSaveDraft: (row: PaidInfoGridRow) => void
  onCancelDraft: (row: PaidInfoGridRow) => void
}

function MenuCell(props: CustomCellRendererProps<PaidInfoGridRow, unknown, PaidInfoGridContext>) {
  const row = props.data
  if (!row) return null
  if (isDraftPaidGridRow(row)) {
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

const defaultColDef: ColDef<PaidInfoGridRow> = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
  editable: (p) => isDraftPaidGridRow(p.data),
}

type Props = {
  rows: PaidInfoGridRow[]
  context: PaidInfoGridContext
  onCellValueChanged: (e: CellValueChangedEvent<PaidInfoGridRow>) => void
  height?: number
}

export default function PaidInfoAgGrid({
  rows,
  context,
  onCellValueChanged,
  height = 520,
}: Props) {
  const columnDefs = useMemo<ColDef<PaidInfoGridRow>[]>(
    () => [
      {
        field: 'paidId',
        headerName: 'NO',
        width: 80,
        maxWidth: 100,
        filter: 'agNumberColumnFilter',
        editable: false,
        valueFormatter: (p) => (isDraftPaidGridRow(p.data) ? '—' : String(p.value ?? '')),
      },
      {
        field: 'accNm',
        headerName: '계정명',
        minWidth: 100,
        maxWidth: 160,
        editable: true,
      },
      {
        field: 'accNo',
        headerName: '계정번호',
        minWidth: 100,
        maxWidth: 140,
        editable: true,
      },
      {
        field: 'subject',
        headerName: '제목',
        minWidth: 120,
        maxWidth: 200,
        editable: true,
      },
      {
        field: 'memo',
        headerName: '메모',
        flex: 1,
        minWidth: 160,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'cateCd',
        headerName: '분류코드',
        width: 110,
        maxWidth: 130,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'cateNm',
        headerName: '분류명',
        width: 110,
        maxWidth: 140,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'price',
        headerName: '금액',
        width: 100,
        maxWidth: 120,
        filter: 'agNumberColumnFilter',
        editable: true,
        valueParser: (p) => {
          const n = Number(String(p.newValue).replace(/,/g, ''))
          return Number.isFinite(n) ? n : null
        },
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'ioType',
        headerName: '구분',
        width: 72,
        maxWidth: 90,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'paidDt',
        headerName: '일자',
        width: 120,
        maxWidth: 140,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftPaidGridRow(p.data) ? '' : '-'
          return String(v)
        },
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
        '& .ag-cell[col-id="subject"]': { justifyContent: 'flex-start', fontWeight: 500 },
        '& .ag-cell[col-id="menu"]': { justifyContent: 'center' },
        '& .ag-row-pinned .ag-cell': { fontStyle: 'normal' },
      }}
    >
      <AgGridReact<PaidInfoGridRow>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => (p.data.draftKey ? p.data.draftKey : String(p.data.paidId))}
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
