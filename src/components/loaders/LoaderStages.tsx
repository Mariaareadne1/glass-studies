import type { EnvironmentKind } from '../../glass/types';
import { CrystalLoader } from './crystalLoader';
import { LoaderStage } from './LoaderStage';
import { MorphLoader } from './morphLoader';
import { OrbitLoader } from './orbitLoader';
import { TideLoader } from './tideLoader';

export const MorphLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new MorphLoader()} label="Pixel Morph loader" testid="loader-morph" />;
export const TideLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new TideLoader()} label="Tide Fill loader" testid="loader-tide" />;
export const OrbitLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new OrbitLoader()} label="Orbit loader" testid="loader-orbit" />;
export const CrystalLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new CrystalLoader()} label="Crystallize loader" testid="loader-crystal" />;
