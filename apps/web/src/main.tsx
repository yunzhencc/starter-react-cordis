import { webAppPlugins } from '@yunzhen/cordis-bundle-web-app'
import { RuntimeProvider } from '@yunzhen/cordis-react-bridge'
import { createAppRouter } from '@yunzhen/cordis-react-router'
import { createAppRuntime } from '@yunzhen/cordis-runtime'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles.css'

async function bootstrap() {
  const runtime = await createAppRuntime(webAppPlugins)
  const router = createAppRouter(runtime)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RuntimeProvider runtime={runtime}>
        <RouterProvider router={router} />
      </RuntimeProvider>
    </StrictMode>,
  )
}

void bootstrap()
