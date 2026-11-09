import type { EnvironmentKind } from '../../glass/types';
import type { IconName } from '../../pixels/iconDefinitions';
import { ASSEMBLY_FAMILIES, ASSEMBLY_SEQUENCE, AssemblyLoader } from './assemblyLoader';
import { CrystalLoader } from './crystalLoader';
import { LoaderStage } from './LoaderStage';
import { MergeLoader } from './mergeLoader';
import { OrbitLoader } from './orbitLoader';
import { TideLoader } from './tideLoader';
import { useLoaderOption } from './useLoaderOption';

const ICON_LABEL: Partial<Record<IconName, string>> = { sun: 'Sun', cloud: 'Cloud', leaf: 'Leaf', moon: 'Moon' };

function AssemblyOptions({ ctrl }: { ctrl: AssemblyLoader }) {
  const [family, setFamily] = useLoaderOption(ctrl, () => ctrl.currentFamily, (f) => ctrl.setFamily(f));
  const [icon, setIcon] = useLoaderOption(ctrl, () => ctrl.currentIcon, (i) => ctrl.setTarget(i));
  return (
    <div className="transport__row">
      <div className="chip-row" role="radiogroup" aria-label="Transition">
        {ASSEMBLY_FAMILIES.map((f) => (
          <button key={f.id} type="button" role="radio" className="chip" aria-checked={family === f.id} onClick={() => setFamily(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {ctrl.transport.mode === 'progress' && (
        <div className="chip-row" role="radiogroup" aria-label="Icon to assemble">
          {ASSEMBLY_SEQUENCE.map((n) => (
            <button key={n} type="button" role="radio" className="chip" aria-checked={icon === n} onClick={() => setIcon(n)}>
              {ICON_LABEL[n]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const AssemblyLoaderStage = ({ env }: { env: EnvironmentKind }) => (
  <LoaderStage env={env} create={() => new AssemblyLoader()} label="Pixel Assembly loader" testid="loader-morph" extra={(c) => <AssemblyOptions ctrl={c} />} />
);
export const TideLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new TideLoader()} label="Tide Fill loader" testid="loader-tide" />;
export const OrbitLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new OrbitLoader()} label="Orbit loader" testid="loader-orbit" />;
export const CrystalLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new CrystalLoader()} label="Crystallize loader" testid="loader-crystal" />;
export const MergeLoaderStage = ({ env }: { env: EnvironmentKind }) => <LoaderStage env={env} create={() => new MergeLoader()} label="Merge loader" testid="loader-merge" />;
