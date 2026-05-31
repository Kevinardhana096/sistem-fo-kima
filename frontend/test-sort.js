const allDocuments = [
    { id: 1, jenisDokumen: "penawaran", nomorDokumen: "123", tanggalDokumen: "2023-01-01" },
    { id: 2, jenis_dokumen: "tanggapan", nomor_dokumen: "456", tanggal_dokumen: "2023-01-02" }
];
const documentSearch = "";
const documentSort = "desc";
const documentTypeLabelMap = { penawaran: "Penawaran", tanggapan: "Tanggapan" };

const filteredAndSortedDocs = allDocuments
    .filter(doc => {
        if (!documentSearch) return true;
        const searchLower = documentSearch.toLowerCase();
        const label = (documentTypeLabelMap[doc?.jenisDokumen] || doc?.jenisDokumen || "").toLowerCase();
        const noRef = (doc?.nomorDokumen || "").toLowerCase();
        return label.includes(searchLower) || noRef.includes(searchLower);
    })
    .sort((a, b) => {
        const dateA = a?.tanggalDokumen ? new Date(a.tanggalDokumen).getTime() : 0;
        const dateB = b?.tanggalDokumen ? new Date(b.tanggalDokumen).getTime() : 0;
        return documentSort === "desc" ? dateB - dateA : dateA - dateB;
    });

console.log(filteredAndSortedDocs.length);
console.log(filteredAndSortedDocs);
