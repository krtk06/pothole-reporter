import { NextRequest, NextResponse } from "next/server";
import { getTenderData, submitContractorBid } from "@/lib/tenderStore";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenderId = searchParams.get("tender_id");
  const store = getTenderData();

  if (tenderId) {
    const bids = store.bids.filter((b) => b.tender_id === tenderId);
    return NextResponse.json({ bids });
  }

  return NextResponse.json({ bids: store.bids });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.tender_id || !body.contractor_name || !body.company_name || !body.bid_amount) {
      return NextResponse.json(
        { error: "Missing required fields: tender_id, contractor_name, company_name, bid_amount" },
        { status: 400 }
      );
    }

    const newBid = submitContractorBid({
      tender_id: body.tender_id,
      contractor_name: body.contractor_name,
      company_name: body.company_name,
      license_number: body.license_number || "REG-PENDING",
      email: body.email || "contractor@example.com",
      phone: body.phone || "—",
      bid_amount: Number(body.bid_amount),
      estimated_days: Number(body.estimated_days || 15),
      proposal_notes: body.proposal_notes || "",
    });

    return NextResponse.json({ success: true, bid: newBid });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal Server Error", message: err.message },
      { status: 500 }
    );
  }
}
