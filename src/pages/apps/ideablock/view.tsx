import { AppDataViewPage } from '../basic/view'

const APP_ID = 10
const BASE_PATH = '/apps/ideablock'

export default function IdeaBlockViewPage() {
  return <AppDataViewPage appId={APP_ID} basePath={BASE_PATH} menuCd="ideablock" />
}
