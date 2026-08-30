/// Indicador de carga instantáneo. Next lo muestra apenas se hace clic en una
/// sección, mientras el servidor arma la página. Así la navegación nunca se
/// siente congelada, aunque el render tarde unos segundos.
export default function Cargando() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-[rgba(19,28,36,.14)] border-t-azul-700"
          role="status"
          aria-label="Cargando"
        />
        <p className="text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
          Cargando…
        </p>
      </div>
    </div>
  );
}
