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

import type { BaseConfigRow } from '../../apis/baseConfigApi'

ModuleRegistry.registerModules([AllCommunityModule])

/** 서버 행 + 목록에만 있는 신규 행(draftKey 있음) */
export type BaseConfigGridRow = BaseConfigRow & { draftKey?: string }

export function isDraftGridRow(row: BaseConfigGridRow | undefined): boolean {
  return Boolean(row?.draftKey)
}

export type BaseConfigGridContext = {
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, row: BaseConfigRow) => void
  onSaveDraft: (row: BaseConfigGridRow) => void
  onCancelDraft: (row: BaseConfigGridRow) => void
}

function formatDateCell(s: string) {
  return s?.slice(0, 10) ?? ''
}

function MenuCell(props: CustomCellRendererProps<BaseConfigGridRow, unknown, BaseConfigGridContext>) {
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

const defaultColDef: ColDef<BaseConfigGridRow> = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
  editable: (p) => isDraftGridRow(p.data),
}

type Props = {
  rows: BaseConfigGridRow[]
  context: BaseConfigGridContext
  onCellValueChanged: (e: CellValueChangedEvent<BaseConfigGridRow>) => void
  height?: number
}

export default function BaseConfigAgGrid({
  rows,
  context,
  onCellValueChanged,
  height = 480,
}: Props) {
  const columnDefs = useMemo<ColDef<BaseConfigGridRow>[]>(
    () => [
      {
        field: 'configId',
        headerName: 'NO',
        width: 88,
        maxWidth: 120,
        filter: 'agNumberColumnFilter',
        editable: false,
        valueFormatter: (p) => (isDraftGridRow(p.data) ? '—' : String(p.value ?? '')),
      },
      {
        field: 'cfSubject',
        headerName: '제목',
        minWidth: 140,
        maxWidth: 220,
        editable: true,
      },
      {
        field: 'cfKey',
        headerName: '키',
        maxWidth: 220,
        width: 220,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') {
            return isDraftGridRow(p.data) ? '' : '-'
          }
          return String(v)
        },
      },
      {
        field: 'cfVal',
        headerName: '값',
        flex: 1,
        minWidth: 220,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') {
            return isDraftGridRow(p.data) ? '' : '-'
          }
          return String(v)
        },
      },
      {
        field: 'sortNo',
        headerName: '정렬',
        width: 96,
        maxWidth: 120,
        filter: 'agNumberColumnFilter',
        valueParser: (p) => {
          const n = Number(String(p.newValue).replace(/,/g, ''))
          return Number.isFinite(n) ? n : 0
        },
        hide: true,
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
        '& .ag-cell[col-id="cfSubject"]': { justifyContent: 'flex-start', fontWeight: 500 },
        '& .ag-cell[col-id="menu"]': { justifyContent: 'center' },
        '& .ag-row-pinned .ag-cell': { fontStyle: 'normal' },
      }}
    >
      <AgGridReact<BaseConfigGridRow>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => (p.data.draftKey ? p.data.draftKey : String(p.data.configId))}
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
