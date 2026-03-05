import { AppShellView } from "./features/layout/AppShellView";
import { useAppController } from "./hooks/useAppController";

export default function App() {
  const appShellProps = useAppController();

  return <AppShellView {...appShellProps} />;
}
