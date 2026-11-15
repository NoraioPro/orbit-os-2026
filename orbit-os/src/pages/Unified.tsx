import { PageHeader } from '../components/ui';
import { UnifiedGeospatial } from '../modules/UnifiedGeospatial';

/** Unified domain page: Agri × Ocean over one Earth, one Earthdata path. */
export default function Unified() {
  return (
    <div>
      <PageHeader
        icon="Layers"
        title="Unified Geospatial"
        subtitle="Two domains, one Earth: agriculture and ocean indicators from the same NASA Earthdata path — every value labelled live, snapshot or not connected."
      />
      <UnifiedGeospatial />
    </div>
  );
}
