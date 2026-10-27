import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Captura erros de renderização em qualquer componente filho e exibe uma
 * tela de fallback amigável, evitando a tela branca.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Em produção, aqui seria o ponto de envio para um serviço de monitoramento.
    console.error('ErrorBoundary capturou um erro:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <div className="max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <h1 className="text-lg font-bold text-gray-900">Algo deu errado</h1>
            <p className="mt-2 text-sm text-gray-500">
              Ocorreu um erro inesperado ao exibir esta tela. Tente recarregar a página.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
