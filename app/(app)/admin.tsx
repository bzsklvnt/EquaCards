import { AdminCardsScreen } from '@/src/features/admin/AdminCardsScreen';
import { AdminGuard } from '@/src/features/auth/AdminGuard';

export default function AdminTab() {
  return (
    <AdminGuard>
      <AdminCardsScreen />
    </AdminGuard>
  );
}
