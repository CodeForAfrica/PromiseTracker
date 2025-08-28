import { TenantList } from './TenantList'

export const LocalhostWarning = async () => {
  return (
    <div className="home">
      <div className="content">
        <div className="warning">
          <h2>Warning: Localhost does not work properly with subdomains</h2>
          <p>
            Please use{' '}
            <b>
              <i>localtest.me</i>
            </b>{' '}
            instead. This domain points to 127.0.0.1 and supports subdomains.
          </p>
        </div>
        <TenantList />
      </div>
    </div>
  )
}
