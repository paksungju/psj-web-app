import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Chip,
} from '@mui/material'
import TopBar from '../../components/TopBar'

const mockItems = [
  {
    id: 1,
    title: 'Dashboard 디자인',
    description: '메인 대시보드 레이아웃 시안',
    badge: 'UI',
    color: '#1E90FF',
  },
  {
    id: 2,
    title: '컴포넌트 샘플',
    description: '버튼 / 카드 / 모달 컴포넌트 모음',
    badge: 'Components',
    color: '#10B981',
  },
  {
    id: 3,
    title: '아이콘 컬렉션',
    description: '프로젝트에서 자주 쓰는 아이콘 모음',
    badge: 'Icons',
    color: '#F59E0B',
  },
  {
    id: 4,
    title: '일러스트 샘플',
    description: '온보딩/빈 상태 화면용 일러스트',
    badge: 'Illustration',
    color: '#EC4899',
  },
]

export default function GalleryPage() {
  return (
    <Box
      sx={{
        flexGrow: 1,
        overflow: 'auto',
        p: 3,
      }}
    >
      <TopBar />
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          backgroundColor: 'background.paper',
          minHeight: '100%',
        }}
      >
        <Typography variant="h5" sx={{ mb: 1.5, fontWeight: 600 }}>
          겔러리
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          UI 시안, 컴포넌트, 아이콘 등 시각 자료를 카드 형태로 모아 보는 공간입니다.
        </Typography>

        <Grid container spacing={2.5}>
          {mockItems.map((item) => (
            <Grid key={item.id} item xs={12} sm={6} md={4} lg={3}>
              <Card
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea sx={{ alignItems: 'stretch' }}>
                  <CardMedia
                    sx={{
                      height: 120,
                      background: `linear-gradient(135deg, ${item.color}, #111827)`,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-start',
                      p: 1.5,
                    }}
                  >
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        color: '#111827',
                        fontWeight: 600,
                      }}
                    />
                  </CardMedia>
                  <CardContent
                    sx={{
                      minHeight: 96,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, mb: 0.5 }}
                      noWrap
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {item.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  )
}

