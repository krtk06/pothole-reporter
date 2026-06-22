"use client";

import { MapPin, Clock, CheckCircle, XCircle, HelpCircle, Wrench } from "lucide-react";
import { Report } from "@/types";

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", label: "Pending" },
  verified: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", label: "Verified" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", label: "Rejected" },
  fixed: { icon: Wrench, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Fixed" },
};

export default function ReportCard({ report }: { report: Report }) {
  const status = statusConfig[report.status];
  const StatusIcon = status.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
          </span>
        </div>
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </span>
      </div>

      {report.address_notes && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          {report.address_notes}
        </p>
      )}

      {report.block_id && (
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
          Block: {report.block_id}
        </p>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        {new Date(report.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
