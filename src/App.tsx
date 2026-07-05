import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import AppRoutes from './routes'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme: muiTheme, ownerState }) => ({
          ...(ownerState.fullWidth && {
            [muiTheme.breakpoints.down('sm')]: {
              mx: muiTheme.spacing(0.75),
              width: 'calc(100% - 12px)',
              maxWidth: 'calc(100% - 12px)',
            },
          }),
        }),
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppRoutes />
    </ThemeProvider>
  )
}

export default App
