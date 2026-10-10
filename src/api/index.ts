import { DataSource } from './dataSource';
import { LocalEngineSource } from './LocalEngineSource';
import { RemoteSource } from './RemoteSource';

export * from './dataSource';
export * from './LocalEngineSource';
export * from './RemoteSource';

const dataSourceType = import.meta.env.VITE_DATA_SOURCE;

export const isRemoteMode = dataSourceType === 'remote';

// Create singleton instance according to environment
export const dataSource: DataSource = isRemoteMode ? new RemoteSource() : new LocalEngineSource();
