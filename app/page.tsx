'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { create } from 'zustand';

// Type definitions
interface CsvRow {
  [key: string]: string;
}

interface Category {
  total: number;
  items: CsvRow[];
}

interface Categories {
  [categoryName: string]: Category;
}

interface KakeiboState {
  file: File | null;
  categories: Categories | null;
  isLoading: boolean;
  error: string | null;
  setFile: (file: File) => void;
  reset: () => void;
  processCsv: (file: File) => void;
}

interface IconProps {
  className?: string;
  [key: string]: any;
}

interface TooltipProps {
  children: React.ReactNode;
  text: React.ReactNode;
}

// --- Icon Components (using inline SVG) ---
// Using inline SVGs because external libraries like lucide-react might not be available.
const HelpCircle = (props: IconProps) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
);

const Github = (props: IconProps) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const UploadCloud = (props: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M12 12v9" />
        <path d="m16 16-4-4-4 4" />
    </svg>
);

const FileText = (props: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
    </svg>
);

const ChevronDown = (props: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const X = (props: IconProps) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);


// --- Zustand Store for State Management ---
// アプリケーションの状態を管理するためのZustandストア
const useKakeiboStore = create<KakeiboState>((set) => ({
  file: null,
  categories: null,
  isLoading: false,
  error: null,
  setFile: (file: File) => set({ file, categories: null, error: null }),
  reset: () => set({ file: null, categories: null, error: null, isLoading: false }),
  processCsv: (file: File) => {
    set({ isLoading: true, error: null });
    
    // 楽天e-naviのCSVはShift_JISなので、そのエンコーディングで読み込む
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        Papa.parse<CsvRow>(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<CsvRow>) => {
            const processedData = processData(results.data);
            set({ categories: processedData, isLoading: false });
          },
          error: (err: Error) => {
            set({ error: `CSVの解析に失敗しました: ${err.message}`, isLoading: false });
          }
        });
      } catch (err: unknown) {
        set({ error: `ファイルの読み込みに失敗しました: ${err instanceof Error ? err.message : 'Unknown error'}`, isLoading: false });
      }
    };
    reader.onerror = () => {
        set({ error: 'ファイルの読み込み中にエラーが発生しました。', isLoading: false });
    };
    reader.readAsText(file, 'Shift_JIS'); // Encoding for Rakuten Card CSV
  },
}));

// --- Data Processing Logic ---
// CSVデータを分類し、集計するコアロジック
const processData = (data: CsvRow[]): Categories => {
  const CONVENIENCE_STORES = ['ｾﾌﾞﾝ-ｲﾚﾌﾞﾝ', 'ﾌｱﾐﾘｰﾏｰﾄ', 'ﾛｰｿﾝ'];
  const SUBSCRIPTIONS = [
    'chocoZAP', 'ﾁｮｺｻﾞｯﾌﾟ', 'CLAUDE.AI', 'ADOBESYS', 'SCRIBD.C', 
    'ﾕｰﾈｸｽﾄ', 'AMAZON WEB SERVICES', 'GOOGLE WORKSPACE', 'NETFLIX', 'SPOTIFY'
  ];

  const categories: Categories = {
    'コンビニ': { total: 0, items: [] },
    'povo': { total: 0, items: [] },
    'サブスク': { total: 0, items: [] },
    'Suica': { total: 0, items: [] },
    '少額決済 (JCB)': { total: 0, items: [] },
    'その他': { total: 0, items: [] },
  };

  // 9列目のカラム名を取得（"X月支払金額"など変動するため）
  const paymentMonthColumn = data.length > 0 ? Object.keys(data[0])[8] : null;

  data.forEach((row: CsvRow) => {
    // BOMや不要な文字をキーから除去
    const cleanedRow: CsvRow = {};
    for (const key in row) {
        const cleanedKey = key.replace(/\uFEFF/g, '').trim();
        cleanedRow[cleanedKey] = row[key];
    }

    const merchant = cleanedRow['利用店名・商品名'] || '';
    const amountStr = cleanedRow['利用金額'] || '0';
    const amount = parseInt(amountStr.replace(/,/g, ''), 10) || 0;
    
    // 有効な行か（利用日と利用金額があるか）を判定
    if (!cleanedRow['利用日'] || !/^\d{4}\/\d{2}\/\d{2}$/.test(cleanedRow['利用日']) || !merchant || isNaN(amount)) {
      return;
    }

    let categorized = false;

    // 1. コンビニ
    if (CONVENIENCE_STORES.some(store => merchant.includes(store))) {
      categories['コンビニ'].items.push(cleanedRow);
      categories['コンビニ'].total += amount;
      categorized = true;
    }
    // 2. povo
    else if (merchant.toLowerCase().includes('povo')) {
      categories['povo'].items.push(cleanedRow);
      categories['povo'].total += amount;
      categorized = true;
    }
    // 3. Suica
    else if (merchant.includes('Ｓｕｉｃａ')) { // Full-width Suica
      categories['Suica'].items.push(cleanedRow);
      categories['Suica'].total += amount;
      categorized = true;
    }
    // 4. サブスク
    else if (SUBSCRIPTIONS.some(sub => merchant.toUpperCase().includes(sub.toUpperCase()))) {
      categories['サブスク'].items.push(cleanedRow);
      categories['サブスク'].total += amount;
      categorized = true;
    }
    // 5. 少額決済
    else if (merchant.includes('ＪＣＢ') && amount <= 1200) {
      categories['少額決済 (JCB)'].items.push(cleanedRow);
      categories['少額決済 (JCB)'].total += amount;
      categorized = true;
    }
    
    // 6. その他
    if (!categorized) {
      categories['その他'].items.push(cleanedRow);
      // 「その他」は9列目の金額を利用
      const otherAmountStr = paymentMonthColumn ? (cleanedRow[paymentMonthColumn] || '0') : '0';
      const otherAmount = parseInt(otherAmountStr.replace(/,/g, ''), 10) || 0;
      categories['その他'].total += otherAmount;
    }
  });

  // アイテム数が0のカテゴリをフィルタリング
  return Object.entries(categories)
    .filter(([_, value]) => value.items.length > 0)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as Categories);
};

// --- UI Components ---

// Tooltip Component
const Tooltip = ({ children, text }: TooltipProps) => {
  return (
    <div className="relative flex items-center group">
      {children}
      <div className="absolute bottom-full mb-2 w-64 p-2 text-sm text-white bg-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        {text}
      </div>
    </div>
  );
};

// Header Component
const AppHeader = () => {
    const helpText = (
        <div className="text-left">
            <h4 className="font-bold mb-2">計算方法について</h4>
            <ul className="list-disc list-inside space-y-1">
                <li><strong>コンビニ:</strong> 「セブン-イレブン」「ファミリーマート」「ローソン」が店名に含まれる利用。</li>
                <li><strong>povo:</strong> 「povo」が店名に含まれる利用。</li>
                <li><strong>Suica:</strong> 「Ｓｕｉｃａ」が店名に含まれる利用。</li>
                <li><strong>サブスク:</strong> 事前定義されたリスト（chocoZAP, CLAUDE.AI, Adobe等）に合致する利用。</li>
                <li><strong>少額決済 (JCB):</strong> 上記以外で1200円以下の「JCB」利用。</li>
                <li><strong>その他:</strong> 上記のいずれにも当てはまらない利用。合計金額はCSVの9列目（「X月支払金額」）を使用します。</li>
            </ul>
            <p className="mt-3 pt-2 border-t border-gray-600">
                計算はすべてお使いのブラウザ内で完結し、外部にデータが送信されることはありません。
            </p>
        </div>
    );

    return (
        <header className="text-center p-8 bg-cream-100">
            <h1 className="text-4xl md:text-5xl font-bold text-green-800 mb-2">
                かんたん家計簿
            </h1>
            <p className="text-green-700 max-w-2xl mx-auto">
                楽天カードの利用明細CSVをアップロードするだけで、支出を自動でカテゴリ分けします。
            </p>
            <div className="flex justify-center items-center gap-4 mt-4">
                <Tooltip text={helpText}>
                    <HelpCircle className="h-6 w-6 text-green-700 cursor-pointer hover:text-green-900" />
                </Tooltip>
                <a 
                    href="https://login.account.rakuten.com/sso/authorize?client_id=rakuten_card_enavi_web&redirect_uri=https://www.rakuten-card.co.jp/e-navi/auth/login.xhtml&scope=openid%20profile&response_type=code&prompt=login#/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors"
                >
                    楽天e-NAVIへ
                </a>
            </div>
        </header>
    );
};


// CSV Uploader Component
const CsvUploader = () => {
  const { setFile, processCsv } = useKakeiboStore();
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setFile(file);
        processCsv(file);
      } else {
        useKakeiboStore.setState({ error: 'CSVファイルを選択してください。' });
      }
    }
  }, [setFile, processCsv]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-4 border-dashed rounded-2xl p-10 md:p-20 text-center cursor-pointer transition-colors duration-300
        ${isDragActive ? 'border-green-500 bg-green-50' : 'border-green-200 hover:border-green-400'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-green-700">
        <UploadCloud className="h-16 w-16 mb-4"/>
        {isDragActive ? (
          <p className="text-xl font-semibold">ここにファイルをドロップ</p>
        ) : (
          <p className="text-xl font-semibold">CSVファイルをここにドラッグ＆ドロップ<br />またはクリックして選択</p>
        )}
        <p className="text-sm mt-2">楽天e-NAVIからダウンロードした利用明細CSVに対応しています。</p>
      </div>
    </div>
  );
};

// Results Display Component
const ResultsDisplay = () => {
  const { categories, file, isLoading, error, reset } = useKakeiboStore();
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center p-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto"></div>
        <p className="mt-4 text-green-800">計算中...</p>
    </div>;
  }
  
  if (error) {
    return (
        <div className="text-center p-10 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-semibold">エラーが発生しました</p>
            <p className="text-red-600 mt-2">{error}</p>
            <button onClick={reset} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                やり直す
            </button>
        </div>
    );
  }

  if (!categories) return null;

  const paymentMonthColumn = categories[Object.keys(categories)[0]]?.items.length > 0 
    ? Object.keys(categories[Object.keys(categories)[0]].items[0])[8] 
    : '8月支払金額';

  return (
    <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-gray-600">
                <FileText className="h-5 w-5"/>
                <span>{file?.name}</span>
            </div>
            <button onClick={reset} className="flex items-center gap-1 text-red-500 hover:text-red-700">
                <X className="h-4 w-4"/>
                <span>クリア</span>
            </button>
        </div>
        <div className="space-y-2">
            {Object.entries(categories).map(([category, data]) => (
                <div key={category} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button 
                        onClick={() => setOpenAccordion(openAccordion === category ? null : category)}
                        className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-lg font-medium text-gray-800">{category}</span>
                        <div className="flex items-center gap-4">
                            <span className="text-lg font-bold text-green-700">
                                {(data as Category).total.toLocaleString()} 円
                            </span>
                            <ChevronDown className={`h-6 w-6 text-gray-500 transition-transform ${openAccordion === category ? 'rotate-180' : ''}`} />
                        </div>
                    </button>
                    {openAccordion === category && (
                        <div className="bg-gray-50 p-4 border-t border-gray-200">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2">利用日</th>
                                            <th className="px-4 py-2">利用店名・商品名</th>
                                            <th className="px-4 py-2 text-right">利用金額</th>
                                            {category === 'その他' && <th className="px-4 py-2 text-right">{paymentMonthColumn}</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data as Category).items.map((item: CsvRow, index: number) => {
                                            const cleanedItem = Object.fromEntries(Object.entries(item).map(([k, v]) => [k.replace(/\uFEFF/g, '').trim(), v]));
                                            const amount = parseInt((cleanedItem['利用金額'] || '0').replace(/,/g, ''), 10) || 0;
                                            const otherAmount = category === 'その他' && paymentMonthColumn ? parseInt((cleanedItem[paymentMonthColumn] || '0').replace(/,/g, ''), 10) || 0 : 0;
                                            return (
                                                <tr key={index} className="border-b last:border-b-0 hover:bg-white">
                                                    <td className="px-4 py-2 whitespace-nowrap">{cleanedItem['利用日'] as React.ReactNode}</td>
                                                    <td className="px-4 py-2">{cleanedItem['利用店名・商品名'] as React.ReactNode}</td>
                                                    <td className="px-4 py-2 text-right whitespace-nowrap">{amount.toLocaleString()} 円</td>
                                                    {category === 'その他' && <td className="px-4 py-2 text-right whitespace-nowrap">{otherAmount.toLocaleString()} 円</td>}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};

// Footer Component
const AppFooter = () => (
    <footer className="text-center p-4 mt-8 text-gray-500">
        <div className="flex justify-center items-center gap-4">
            <a href="https://github.com/Tsukichan" target="_blank" rel="noopener noreferrer" className="hover:text-gray-800">
                <Github className="h-6 w-6" />
            </a>
            <p>&copy; Tsukichan 2025</p>
        </div>
    </footer>
);


// Main App Component
export default function App() {
  const { file } = useKakeiboStore();

  return (
    <div className="min-h-screen bg-cream-50 font-sans text-gray-800">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        {!file ? <CsvUploader /> : <ResultsDisplay />}
      </main>
      <AppFooter />
      {/* Script for PapaParse */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js"></script>
      {/* Custom Styles */}
      <style jsx global>{`
        body {
          background-color: #FEFBF6; /* cream-50 */
        }
        .bg-cream-50 { background-color: #FEFBF6; }
        .bg-cream-100 { background-color: #F8F0E3; }
        .text-green-700 { color: #3D550C; }
        .text-green-800 { color: #2C3E0A; }
        .text-green-900 { color: #1E2A07; }
        .border-green-200 { border-color: #C2DDB4; }
        .border-green-400 { border-color: #A3C990; }
        .border-green-500 { border-color: #84B56C; }
        .bg-green-50 { background-color: #F0F7E9; }
        .bg-green-600 { background-color: #6A994E; }
        .bg-green-700 { background-color: #3D550C; }
      `}</style>
    </div>
  );
}
