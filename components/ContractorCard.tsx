import Link from "next/link";

import { ExpiryCountdown } from "@/components/ExpiryCountdown";
import { PEBadge } from "@/components/PEBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildContractorHref, formatDateTime } from "@/lib/utils";
import type { Contractor } from "@/types";

type ContractorCardProps = {
  contractor: Contractor;
};

export function ContractorCard({ contractor }: ContractorCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={contractor.registration_status} />
          <PEBadge pe_flag={contractor.pe_flag} />
        </div>
        <CardTitle className="text-lg">
          <Link
            href={buildContractorHref(contractor.crs_number, contractor.contractor_name)}
            className="hover:text-primary"
          >
            {contractor.contractor_name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>CRS {contractor.crs_number}</p>
        <p>
          {contractor.city}, {contractor.province}
        </p>
        <ExpiryCountdown
          expiry_date={contractor.expiry_date}
          status={contractor.registration_status}
        />
        <div className="rounded-2xl bg-secondary/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verification</p>
          <p className="mt-2 text-sm">Captured {formatDateTime(contractor.captured_at)}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={buildContractorHref(contractor.crs_number, contractor.contractor_name)}
              className="font-semibold text-primary hover:underline"
            >
              Review profile
            </Link>
            <Link
              href={contractor.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Verify on CIDB
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
