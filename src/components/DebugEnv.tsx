export function DebugEnv() {
  const disableAuth = import.meta.env.VITE_DISABLE_AUTH;
  const workspaceId = import.meta.env.VITE_WORKSPACE_ID;
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      right: 0, 
      background: 'black', 
      color: 'white', 
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <div>VITE_DISABLE_AUTH: {String(disableAuth)}</div>
      <div>VITE_WORKSPACE_ID: {String(workspaceId)}</div>
      <div>Type of DISABLE_AUTH: {typeof disableAuth}</div>
      <div>Is equal to 'true': {String(disableAuth === 'true')}</div>
    </div>
  );
}