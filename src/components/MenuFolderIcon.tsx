import { Box } from '@mui/material'
import folderClosedImg from '../assets/menu/folder-closed.png'
import folderOpenImg from '../assets/menu/folder-open.png'

type MenuFolderIconProps = {
  open?: boolean
  size?: number
}

export default function MenuFolderIcon({ open = false, size = 20 }: MenuFolderIconProps) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', width: size, height: size, flexShrink: 0, lineHeight: 0 }}
      aria-hidden
    >
      <Box
        component="img"
        src={open ? folderOpenImg : folderClosedImg}
        alt=""
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          mixBlendMode: 'multiply',
        }}
      />
    </Box>
  )
}
