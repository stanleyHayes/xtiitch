import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { Link as RouterLink } from "react-router";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import { ManagementOverviewPanel } from "../overview/ManagementOverviewPanel";
import { StoreReadinessPanel } from "../overview/StoreReadinessPanel";
import { TodayFocusPanel } from "../overview/TodayFocusPanel";
import { ReportsPanel } from "../studio/ReportsPanel";
import { StaffTaskPanel } from "../studio/StaffTaskPanel";
import { MoneyPanel } from "../money/MoneyPanel";
import { BookingQueuePanel } from "../availability/BookingQueuePanel";
import { HandoverPanel } from "../availability/HandoverPanel";
import { AvailabilityPanel } from "../availability/AvailabilityPanel";
import { PromotionPanel } from "../promotions/PromotionPanel";
import { TeamPanel } from "../settings/TeamPanel";
import { NotificationPanel } from "../shared/NotificationPanel";
import { OrdersSection } from "../orders/OrdersSection";
import { CatalogueSection } from "../catalogue/CatalogueSection";
import { MeasurementsSection } from "../settings/MeasurementsSection";
import { SettingsSection } from "../settings/SettingsSection";
import { DashboardMetrics } from "./DashboardMetrics";
import type {
  AvailabilityWindow,
  BookingSummary,
  BusinessPromotion,
  BusinessUser,
  CollectionSummary,
  CurrentUser,
  DashboardActionData,
  DeliveryZone,
  Design,
  HandoverSummary,
  ManualTaking,
  MeasurementField,
  MoneySummary,
  NotificationSummary,
  OrderSummary,
  Profile,
  SizeBand,
  Stage,
  StoreSettings,
  WaitlistEntry,
} from "../shared/types";
import type { OverviewData } from "../overview/useOverviewData";

export function DashboardSections({ // eslint-disable-line complexity, max-lines-per-function -- large presentational component; refactor in follow-up
  section,
  canManage,
  orders,
  stages,
  measurementFields,
  moneySummary,
  manualTakings,
  bookings,
  handovers,
  notifications,
  availabilityWindows,
  blackoutDates,
  businessUsers,
  storeSettings,
  collections,
  sizeBands,
  promotions,
  waitlistEntries,
  deliveryZones,
  designs,
  currentUser,
  orderFilter,
  action,
  overview,
  filteredOrders,
  returnTo,
  catalogueView,
  setCatalogueView,
  openDesignId,
  setOpenDesignId,
  openCatalogueDesign,
  filteredCatalogueDesigns,
  pagedCatalogueDesigns,
  cataloguePage,
  cataloguePageCount,
  setCataloguePage,
  designCollectionFilter,
  setDesignCollectionFilter,
  designTypeFilter,
  setDesignTypeFilter,
  addCustomisation,
  setAddCustomisation,
  setDesignLimitDialogOpen,
  setCatalogueToolsOpen,
  pagedMeasurementFields,
  measurementFieldPage,
  measurementFieldPageCount,
  setMeasurementFieldPage,
  nextFieldSequence,
  imageLimit,
  designLimit,
  atDesignLimit,
  profile,
}: {
  section: string;
  canManage: boolean;
  orders: OrderSummary[];
  stages: Stage[];
  measurementFields: MeasurementField[];
  moneySummary: MoneySummary;
  manualTakings: ManualTaking[];
  bookings: BookingSummary[];
  handovers: HandoverSummary[];
  notifications: NotificationSummary[];
  availabilityWindows: AvailabilityWindow[];
  blackoutDates: string[];
  businessUsers: BusinessUser[];
  storeSettings: StoreSettings;
  collections: CollectionSummary[];
  sizeBands: SizeBand[];
  promotions: BusinessPromotion[];
  waitlistEntries: WaitlistEntry[];
  deliveryZones: DeliveryZone[];
  designs: Design[];
  currentUser: CurrentUser;
  orderFilter: string;
  action: DashboardActionData;
  overview: OverviewData;
  filteredOrders: OrderSummary[];
  returnTo: string;
  catalogueView: "all" | "add";
  setCatalogueView: (value: "all" | "add") => void;
  openDesignId: string | null;
  setOpenDesignId: (id: string | null) => void;
  openCatalogueDesign: Design | null;
  filteredCatalogueDesigns: Design[];
  pagedCatalogueDesigns: Design[];
  cataloguePage: number;
  cataloguePageCount: number;
  setCataloguePage: (page: number) => void;
  designCollectionFilter: string;
  setDesignCollectionFilter: (value: string) => void;
  designTypeFilter: "all" | "made_to_wear" | "bespoke";
  setDesignTypeFilter: (value: "all" | "made_to_wear" | "bespoke") => void;
  addCustomisation: boolean;
  setAddCustomisation: (value: boolean) => void;
  setDesignLimitDialogOpen: (open: boolean) => void;
  setCatalogueToolsOpen: (mode: "collections" | "sizeBands" | null) => void;
  pagedMeasurementFields: MeasurementField[];
  measurementFieldPage: number;
  measurementFieldPageCount: number;
  setMeasurementFieldPage: (page: number) => void;
  nextFieldSequence: number;
  imageLimit: number;
  designLimit: number | null;
  atDesignLimit: boolean;
  profile: Profile;
}) {
  return (
    <>
      {(section === "overview" || section === "tasks") && (
        <DashboardMetrics
          canManage={canManage}
          liveOrders={overview.liveOrders}
          pendingPayments={overview.pendingPayments}
          needsMeasurements={overview.needsMeasurements}
          activeBookings={overview.activeBookings}
          openHandovers={overview.openHandovers}
          readyForHandover={overview.readyForHandover}
          moneySummary={moneySummary}
        />
      )}

      <Box sx={{ mt: 2.5 }}>
        {canManage && section === "reports" && (
          <ReportsPanel
            revenueBuckets={overview.revenueBuckets}
            stageMetrics={overview.stageMetrics}
            followUps={overview.followUps}
            totalRevenueMinor={overview.sevenDayRevenueMinor}
            completionRate={overview.completionRate}
            collectionRate={overview.collectionRate}
          />
        )}
        {!canManage && section === "tasks" && (
          <StaffTaskPanel
            orders={orders}
            bookings={bookings}
            handovers={handovers}
            followUps={overview.followUps}
            needsMeasurements={overview.needsMeasurements}
            activeBookings={overview.activeBookings}
            openHandovers={overview.openHandovers}
            readyForHandover={overview.readyForHandover}
            pendingMessages={overview.pendingMessages}
          />
        )}
      </Box>

      <Box
        sx={{
          mt: 2.5,
          display: "grid",
          gap: { xs: 2.5, xl: 3 },
          gridTemplateColumns: {
            xs: "1fr",
            xl:
              canManage && section === "overview"
                ? "minmax(0, 1.35fr) minmax(320px, 0.65fr)"
                : "1fr",
          },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack spacing={2.5}>
            {canManage && section === "overview" && (
              <ManagementOverviewPanel rooms={overview.overviewRooms} />
            )}

            {canManage && section === "money" && (
              <MoneyPanel
                summary={moneySummary}
                takings={manualTakings}
                orders={orders}
                error={action.moneyError}
              />
            )}

            {canManage && section === "promotions" && (
              <PromotionPanel
                promotions={promotions}
                collections={collections}
                designs={designs}
                activeCount={overview.activePromotions}
                redeemedMinor={overview.promoRedeemedMinor}
                error={action.promotionError}
              />
            )}

            {section === "visits" && (
              <BookingQueuePanel
                bookings={bookings}
                error={action.bookingError}
              />
            )}

            {section === "orders" && (
              <OrdersSection
                canManage={canManage}
                orders={orders}
                filteredOrders={filteredOrders}
                stages={stages}
                measurementFields={measurementFields}
                orderFilter={orderFilter}
                pendingPayments={overview.pendingPayments}
                needsMeasurements={overview.needsMeasurements}
                readyForHandover={overview.readyForHandover}
                returnTo={returnTo}
                walkInError={action.walkInError}
                orderError={action.orderError}
                measurementError={action.measurementError}
              />
            )}

            {section === "handovers" && (
              <HandoverPanel
                handovers={handovers}
                orders={orders}
                error={action.handoverError}
              />
            )}

            {canManage && section === "catalogue" && (
              <CatalogueSection
                designs={designs}
                collections={collections}
                sizeBands={sizeBands}
                profile={profile}
                action={action}
                imageLimit={imageLimit}
                designLimit={designLimit}
                atDesignLimit={atDesignLimit}
                catalogueView={catalogueView}
                setCatalogueView={setCatalogueView}
                openDesignId={openDesignId}
                setOpenDesignId={setOpenDesignId}
                openCatalogueDesign={openCatalogueDesign}
                filteredCatalogueDesigns={filteredCatalogueDesigns}
                pagedCatalogueDesigns={pagedCatalogueDesigns}
                cataloguePage={cataloguePage}
                cataloguePageCount={cataloguePageCount}
                setCataloguePage={setCataloguePage}
                designCollectionFilter={designCollectionFilter}
                setDesignCollectionFilter={setDesignCollectionFilter}
                designTypeFilter={designTypeFilter}
                setDesignTypeFilter={setDesignTypeFilter}
                addCustomisation={addCustomisation}
                setAddCustomisation={setAddCustomisation}
                setDesignLimitDialogOpen={setDesignLimitDialogOpen}
                setCatalogueToolsOpen={setCatalogueToolsOpen}
                publishedCollections={overview.publishedCollections}
                cataloguePriceCount={overview.cataloguePriceCount}
              />
            )}
          </Stack>
        </Box>

        <Stack spacing={2.5} sx={{ minWidth: 0 }}>
          {canManage && section === "measurements" && (
            <MeasurementsSection
              measurementFields={measurementFields}
              pagedMeasurementFields={pagedMeasurementFields}
              measurementFieldPage={measurementFieldPage}
              measurementFieldPageCount={measurementFieldPageCount}
              setMeasurementFieldPage={setMeasurementFieldPage}
              nextFieldSequence={nextFieldSequence}
              fieldError={action.fieldError}
            />
          )}

          {canManage && section === "availability" && (
            <AvailabilityPanel
              windows={availabilityWindows}
              blackouts={blackoutDates}
              error={action.availabilityError}
            />
          )}

          {canManage && section === "settings" && (
            <SettingsSection
              profile={profile}
              storeSettings={storeSettings}
              deliveryZones={deliveryZones}
              waitlistEntries={waitlistEntries}
              action={action}
            />
          )}

          {canManage && section === "team" && (
            <TeamPanel
              users={businessUsers}
              currentUser={currentUser}
              error={action.teamError}
            />
          )}

          {section === "messages" && (
            <NotificationPanel notifications={notifications} />
          )}

          {canManage && section === "overview" && (
            <>
              {!(profile.payout_ready ?? false) ? (
                <Alert
                  severity="warning"
                  icon={<PaymentsRounded />}
                  action={
                    <Button
                      component={RouterLink}
                      to="/dashboard/settings#payouts"
                      color="inherit"
                      size="small"
                      variant="outlined"
                    >
                      Set up payouts
                    </Button>
                  }
                >
                  <strong>Add your mobile money number to get paid.</strong>{" "}
                  Until you do, customers can&apos;t check out — payments to
                  your store won&apos;t start.
                </Alert>
              ) : null}
              <StoreReadinessPanel
                steps={overview.setupSteps}
                storefrontURL={`https://${profile.handle}.xtiitch.com`}
              />
              <TodayFocusPanel
                pendingPayments={overview.pendingPayments}
                needsMeasurements={overview.needsMeasurements}
                openHandovers={overview.openHandovers}
                pendingMessages={overview.pendingMessages}
              />
            </>
          )}
        </Stack>
      </Box>
    </>
  );
}
