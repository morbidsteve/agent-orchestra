import { useSessionContext } from '../../context/SessionContext.tsx';
import { SessionView } from './SessionView.tsx';

export function SessionWorkspace() {
  const { sessions, activeSessionId } = useSessionContext();

  return (
    <>
      {sessions.map(session => (
        <div
          key={session.id}
          style={{ display: session.id === activeSessionId ? 'block' : 'none' }}
          className="h-full"
        >
          <SessionView sessionId={session.id} />
        </div>
      ))}
    </>
  );
}
