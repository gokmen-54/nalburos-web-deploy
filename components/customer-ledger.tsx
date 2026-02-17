"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import type { AccountEntry, Customer } from "@/lib/types";
import { Field } from "@/components/ui/field";
import { SectionCard } from "@/components/ui/section-card";
import { notify } from "@/lib/toast";

type Props = {
  customers: Customer[];
  entries: AccountEntry[];
};

function money(value: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(value);
}

export function CustomerLedger({ customers, entries }: Props): JSX.Element {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? "");
  const [status, setStatus] = useState("");
  const [historyCustomerId, setHistoryCustomerId] = useState<string>("ALL");
  const [historyType, setHistoryType] = useState<"ALL" | "DEBIT" | "CREDIT">("ALL");
  const [historyText, setHistoryText] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [customerForm, setCustomerForm] = useState({
    code: "",
    name: "",
    phone: "",
    address: "",
    creditLimit: ""
  });
  const [entryForm, setEntryForm] = useState({
    type: "DEBIT" as "DEBIT" | "CREDIT",
    amount: "",
    note: ""
  });
  const [collectionInputs, setCollectionInputs] = useState<Record<string, string>>({});

  const customerEntries = useMemo(() => entries.filter((entry) => entry.customerId === selectedId), [entries, selectedId]);
  const selectedCustomer = customers.find((entry) => entry.id === selectedId);
  const customerNameMap = useMemo(() => {
    return new Map(customers.map((entry) => [entry.id, `${entry.code} - ${entry.name}`]));
  }, [customers]);
  const filteredEntries = useMemo(() => {
    const text = historyText.trim().toLowerCase();
    return entries.filter((entry) => {
      const customerOk = historyCustomerId === "ALL" || entry.customerId === historyCustomerId;
      const typeOk = historyType === "ALL" || entry.type === historyType;
      const textOk =
        !text ||
        entry.note.toLowerCase().includes(text) ||
        (entry.relatedSaleId ?? "").toLowerCase().includes(text) ||
        (customerNameMap.get(entry.customerId) ?? "").toLowerCase().includes(text);

      const created = new Date(entry.createdAt).getTime();
      const fromOk = !historyFrom || created >= new Date(`${historyFrom}T00:00:00`).getTime();
      const toOk = !historyTo || created <= new Date(`${historyTo}T23:59:59`).getTime();
      return customerOk && typeOk && textOk && fromOk && toOk;
    });
  }, [entries, historyCustomerId, historyType, historyText, historyFrom, historyTo, customerNameMap]);
  const customerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        debit: number;
        credit: number;
        todayCredit: number;
      }
    >();
    const today = new Date().toLocaleDateString("tr-TR");
    for (const entry of entries) {
      const current = map.get(entry.customerId) ?? { debit: 0, credit: 0, todayCredit: 0 };
      if (entry.type === "DEBIT") {
        current.debit += entry.amount;
      } else {
        current.credit += entry.amount;
        if (new Date(entry.createdAt).toLocaleDateString("tr-TR") === today) {
          current.todayCredit += entry.amount;
        }
      }
      map.set(entry.customerId, current);
    }
    return map;
  }, [entries]);
  const debtCustomers = useMemo(() => {
    return customers
      .filter((customer) => customer.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [customers]);

  async function postEntry(customerId: string, type: "DEBIT" | "CREDIT", amount: number, note: string): Promise<void> {
    const response = await fetch(`/api/customers/${customerId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        amount,
        note: note.trim()
      })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(data.error ?? "Islem tamamlanamadi.");
    }
  }

  async function createCustomer(): Promise<void> {
    const creditLimit = Number(customerForm.creditLimit || 0);
    if (!customerForm.code.trim() || !customerForm.name.trim()) {
      setStatus("Kod ve musteri adi zorunlu.");
      notify({ type: "error", message: "Kod ve musteri adi zorunlu." });
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      setStatus("Kredi limiti gecersiz.");
      notify({ type: "error", message: "Kredi limiti gecersiz." });
      return;
    }

    setStatus("");
    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: customerForm.code.trim(),
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        address: customerForm.address.trim(),
        creditLimit
      })
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Musteri eklenemedi.");
      notify({ type: "error", message: data.error ?? "Musteri eklenemedi." });
      return;
    }
    setStatus("Musteri eklendi.");
    notify({ type: "success", message: "Musteri eklendi." });
    setCustomerForm({ code: "", name: "", phone: "", address: "", creditLimit: "" });
    router.refresh();
  }

  async function addEntry(): Promise<void> {
    if (!selectedId) {
      setStatus("Musteri sec.");
      notify({ type: "error", message: "Musteri sec." });
      return;
    }
    const amount = Number(entryForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Tutar 0'dan buyuk olmali.");
      notify({ type: "error", message: "Tutar 0'dan buyuk olmali." });
      return;
    }

    setStatus("");
    try {
      await postEntry(selectedId, entryForm.type, amount, entryForm.note);
      setStatus("Cari hareket eklendi.");
      notify({ type: "success", message: "Cari hareket eklendi." });
      setEntryForm((prev) => ({ ...prev, amount: "", note: "" }));
      router.refresh();
    } catch (error) {
      const message = (error as Error).message;
      setStatus(message);
      notify({ type: "error", message });
    }
  }

  async function approveCollection(customerId: string, takeAll = false): Promise<void> {
    const customer = customers.find((entry) => entry.id === customerId);
    if (!customer) {
      return;
    }
    const inputAmount = Number(collectionInputs[customerId] ?? "");
    const amount = takeAll ? customer.balance : inputAmount;
    if (!Number.isFinite(amount) || amount <= 0) {
      notify({ type: "error", message: "Tahsilat tutari 0'dan buyuk olmali." });
      return;
    }
    if (amount > customer.balance) {
      notify({ type: "error", message: "Tahsilat tutari kalan borctan buyuk olamaz." });
      return;
    }
    try {
      await postEntry(customerId, "CREDIT", amount, takeAll ? "Tam borc tahsilati" : "Tahsilat onayi");
      notify({ type: "success", message: `${customer.name} icin tahsilat kaydedildi.` });
      setCollectionInputs((prev) => ({ ...prev, [customerId]: "" }));
      router.refresh();
    } catch (error) {
      notify({ type: "error", message: (error as Error).message });
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <SectionCard title="Yeni Musteri" subtitle="Kod + isim zorunlu. Diger alanlar sonradan tamamlanabilir.">
        <div className="form-grid">
          <Field label="Musteri Kodu" unit="Kod" example="USTA001" required>
            <input value={customerForm.code} onChange={(event) => setCustomerForm((p) => ({ ...p, code: event.target.value }))} placeholder="Kod" />
          </Field>
          <Field label="Musteri Adi" unit="Metin" example="Ahmet Usta" required>
            <input value={customerForm.name} onChange={(event) => setCustomerForm((p) => ({ ...p, name: event.target.value }))} placeholder="Isim" />
          </Field>
          <Field label="Telefon" unit="Numara">
            <input value={customerForm.phone} onChange={(event) => setCustomerForm((p) => ({ ...p, phone: event.target.value }))} placeholder="Telefon" />
          </Field>
          <Field label="Adres" unit="Metin">
            <input value={customerForm.address} onChange={(event) => setCustomerForm((p) => ({ ...p, address: event.target.value }))} placeholder="Adres" />
          </Field>
          <Field label="Kredi Limiti" unit="TL" example="10000">
            <input
              type="number"
              value={customerForm.creditLimit}
              onChange={(event) => setCustomerForm((p) => ({ ...p, creditLimit: event.target.value }))}
              placeholder="Kredi limiti"
            />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn-inline" onClick={() => void createCustomer()}>
            Musteri Ekle
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Cari Takip" subtitle="Veresiye ve tahsilat hareketleri bu bolumden islenir.">
        <div className="form-grid">
          <Field label="Musteri" unit="Secim">
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hareket Tipi" unit="Secim">
            <select value={entryForm.type} onChange={(event) => setEntryForm((p) => ({ ...p, type: event.target.value as "DEBIT" | "CREDIT" }))}>
              <option value="DEBIT">Borclandir (Veresiye)</option>
              <option value="CREDIT">Tahsilat (Alacak Kapat)</option>
            </select>
          </Field>
          <Field label="Tutar" unit="TL" example="1500" required>
            <input
              type="number"
              value={entryForm.amount}
              onChange={(event) => setEntryForm((p) => ({ ...p, amount: event.target.value }))}
              placeholder="Tutar"
            />
          </Field>
          <Field label="Aciklama" unit="Metin" hint="Orn: Mart tahsilati, malzeme veresiye">
            <input value={entryForm.note} onChange={(event) => setEntryForm((p) => ({ ...p, note: event.target.value }))} placeholder="Not" />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn-inline" onClick={() => void addEntry()}>
            Hareket Ekle
          </button>
        </div>

        <p className="muted">
          Bakiye: <strong>{money(selectedCustomer?.balance ?? 0)}</strong> | Kredi Limiti: {money(selectedCustomer?.creditLimit ?? 0)}
        </p>
        {status ? <p className="muted">{status}</p> : null}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tip</th>
                <th>Tutar</th>
                <th>Not</th>
                <th>Kullanici</th>
              </tr>
            </thead>
            <tbody>
              {customerEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{entry.type === "DEBIT" ? "Borclandir" : "Tahsilat"}</td>
                  <td>{money(entry.amount)}</td>
                  <td>{entry.note}</td>
                  <td>{entry.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Islem Gecmisi ve Filtre" subtitle="Tum cari hareketleri buradan filtreleyip geriye donuk inceleyebilirsiniz.">
        <div className="form-grid">
          <Field label="Musteri Filtresi" unit="Secim">
            <select value={historyCustomerId} onChange={(event) => setHistoryCustomerId(event.target.value)}>
              <option value="ALL">Tum musteriler</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hareket Tipi" unit="Secim">
            <select value={historyType} onChange={(event) => setHistoryType(event.target.value as "ALL" | "DEBIT" | "CREDIT")}>
              <option value="ALL">Tum hareketler</option>
              <option value="DEBIT">Borclandir</option>
              <option value="CREDIT">Tahsilat</option>
            </select>
          </Field>
          <Field label="Metin Ara" unit="Metin" example="Satis no veya not">
            <input value={historyText} onChange={(event) => setHistoryText(event.target.value)} placeholder="Not / satis no / musteri ara" />
          </Field>
          <Field label="Baslangic" unit="Tarih">
            <input type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
          </Field>
          <Field label="Bitis" unit="Tarih">
            <input type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
          </Field>
        </div>
        <p className="muted">Gosterilen kayit: {filteredEntries.length}</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Musteri</th>
                <th>Tip</th>
                <th>Tutar</th>
                <th>Ilgili Satis</th>
                <th>Not</th>
                <th>Kullanici</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{customerNameMap.get(entry.customerId) ?? entry.customerId}</td>
                  <td>{entry.type === "DEBIT" ? "Borclandir" : "Tahsilat"}</td>
                  <td>{money(entry.amount)}</td>
                  <td>{entry.relatedSaleId ?? "-"}</td>
                  <td>{entry.note || "-"}</td>
                  <td>{entry.createdBy}</td>
                </tr>
              ))}
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Filtreye uygun kayit bulunamadi.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Veresiye Defteri (Tahsilat Onay)"
        subtitle="Borclu musteriler icin alinan tutari yazip onaylayin. Tum borcu tek tusla kapatabilirsiniz."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Musteri</th>
                <th>Toplam Borclandir</th>
                <th>Toplam Tahsilat</th>
                <th>Bugun Tahsilat</th>
                <th>Kalan Bakiye</th>
                <th>Tahsilat Tutar</th>
                <th>Islem</th>
              </tr>
            </thead>
            <tbody>
              {debtCustomers.map((customer) => {
                const stats = customerStats.get(customer.id) ?? { debit: 0, credit: 0, todayCredit: 0 };
                return (
                  <tr key={customer.id}>
                    <td>{customer.code} - {customer.name}</td>
                    <td>{money(stats.debit)}</td>
                    <td>{money(stats.credit)}</td>
                    <td>{money(stats.todayCredit)}</td>
                    <td>
                      <strong>{money(customer.balance)}</strong>
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <input
                        type="number"
                        value={collectionInputs[customer.id] ?? ""}
                        placeholder="Orn: 500"
                        onChange={(event) => setCollectionInputs((prev) => ({ ...prev, [customer.id]: event.target.value }))}
                      />
                    </td>
                    <td style={{ minWidth: 240 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn-inline secondary" onClick={() => void approveCollection(customer.id, false)}>
                          Tahsilat Onayla
                        </button>
                        <button type="button" className="btn-inline" onClick={() => void approveCollection(customer.id, true)}>
                          Tamamini Al
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {debtCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Acik veresiye bakiyesi olan musteri yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
