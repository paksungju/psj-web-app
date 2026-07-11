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

import type { UserRow } from '../../apis/usersApi'

ModuleRegistry.registerModules([AllCommunityModule])

export type UserGridRow = UserRow & { draftKey?: string }

export function isDraftGridRow(row: UserGridRow | undefined): boolean {
  return Boolean(row?.draftKey)
}

export type UserGridContext = {
  onOpenMenu: (event: React.MouseEvent<HTMLElement>, row: UserRow) => void
  onSaveDraft: (row: UserGridRow) => void
  onCancelDraft: (row: UserGridRow) => void
}

function formatDateCell(s: string) {
  return s?.slice(0, 10) ?? ''
}

function MenuCell(props: CustomCellRendererProps<UserGridRow, unknown, UserGridContext>) {
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

const defaultColDef: ColDef<UserGridRow> = {
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
  editable: (p) => isDraftGridRow(p.data),
}

type Props = {
  rows: UserGridRow[]
  context: UserGridContext
  onCellValueChanged: (e: CellValueChangedEvent<UserGridRow>) => void
  height?: number
}

export default function UsersAgGrid({
  rows,
  context,
  onCellValueChanged,
  height = 480,
}: Props) {
  const columnDefs = useMemo<ColDef<UserGridRow>[]>(
    () => [
      {
        field: 'userId',
        headerName: 'NO',
        width: 88,
        maxWidth: 120,
        filter: 'agNumberColumnFilter',
        editable: false,
        valueFormatter: (p) => (isDraftGridRow(p.data) ? '—' : String(p.value ?? '')),
      },
      {
        field: 'userLoginId',
        headerName: '로그인ID',
        minWidth: 120,
        maxWidth: 160,
        editable: true,
      },
      {
        field: 'userName',
        headerName: '이름',
        minWidth: 100,
        maxWidth: 140,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'userEmail',
        headerName: '이메일',
        flex: 1,
        minWidth: 180,
        editable: true,
      },
      {
        field: 'genderTypeCd',
        headerName: '성별',
        width: 88,
        maxWidth: 100,
        editable: true,
        valueFormatter: (p) => {
          const v = p.value
          if (v == null || v === '') return isDraftGridRow(p.data) ? '' : '-'
          return String(v)
        },
      },
      {
        field: 'userStatusCd',
        headerName: '상태',
        width: 88,
        maxWidth: 100,
        editable: true,
        hide: true,
      },
      {
        field: 'userTypeCd',
        headerName: '유형',
        width: 100,
        maxWidth: 140,
        editable: true,
        hide: true,
      },
      {
        field: 'inDatetime',
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
        '& .ag-cell[col-id="userLoginId"]': { justifyContent: 'flex-start', fontWeight: 500 },
        '& .ag-cell[col-id="menu"]': { justifyContent: 'center' },
        '& .ag-row-pinned .ag-cell': { fontStyle: 'normal' },
      }}
    >
      <AgGridReact<UserGridRow>
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => (p.data.draftKey ? p.data.draftKey : String(p.data.userId))}
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
