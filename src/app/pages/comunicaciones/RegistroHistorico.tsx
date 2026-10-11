/**
 * @file RegistroHistorico.tsx
 * @description Registro histórico de comunicaciones (RF-AC-019).
 *
 * El backend de esta sección aún no está implementado; se muestra un placeholder
 * hasta que se construyan los endpoints de importación histórica y calendario.
 */
import { CalendarDays } from "lucide-react";
import { Vacio } from "./comunicacionesUi";

interface Props {
  onAbrir?: unknown;
  version?: unknown;
}

export function RegistroHistorico(_props: Props) {
  return (
    <Vacio
      icon={CalendarDays}
      titulo="Registro histórico"
      texto="Esta sección está en construcción. Pronto podrás consultar e importar el histórico de comunicaciones."
    />
  );
}
