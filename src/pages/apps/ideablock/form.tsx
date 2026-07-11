import { AppDataFormPage } from '../basic/form'

const APP_ID = 10
const BASE_PATH = '/apps/ideablock'

export default function IdeaBlockFormPage() {
  return (
    <AppDataFormPage
      appId={APP_ID}
      basePath={BASE_PATH}
      menuCd="ideablock"
      savePath="ideablock"
    />
  )
}
