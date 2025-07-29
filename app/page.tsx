'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, Github, UploadCloud, FileText, X } from 'lucide-react';

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
        <header className="text-center p-8 bg-gradient-to-b from-green-50 to-green-100">
            <h1 className="text-4xl md:text-5xl font-bold text-green-800 mb-2">
                かんたん家計簿
            </h1>
            <p className="text-green-700 max-w-2xl mx-auto mb-4">
                楽天カードの利用明細CSVをアップロードするだけで、支出を自動でカテゴリ分けします。
            </p>
            <div className="flex justify-center items-center gap-4">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-green-700 hover:text-green-900">
                                <HelpCircle className="h-6 w-6" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-md">
                            {helpText}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <Button asChild className="bg-green-600 hover:bg-green-700">
                    <a 
                        href="https://login.account.rakuten.com/sso/authorize?client_id=rakuten_card_enavi_web&redirect_uri=https://www.rakuten-card.co.jp/e-navi/auth/login.xhtml&scope=openid%20profile&response_type=code&prompt=login#/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                    >
                        楽天e-NAVIへ
                    </a>
                </Button>
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
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-300 
            ${isDragActive 
              ? 'border-primary bg-accent' 
              : 'border-muted-foreground/25 hover:border-primary hover:bg-accent/50'
            }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-4">
            <UploadCloud className={`h-16 w-16 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`}/>
            {isDragActive ? (
              <p className="text-xl font-semibold text-primary">ここにファイルをドロップ</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xl font-semibold">CSVファイルをドラッグ＆ドロップ</p>
                <p className="text-muted-foreground">またはクリックして選択</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">楽天e-NAVIからダウンロードした利用明細CSVに対応</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Results Display Component
const ResultsDisplay = () => {
  const { categories, file, isLoading, error, reset } = useKakeiboStore();

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg font-medium">計算中...</p>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">エラーが発生しました</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={reset} variant="destructive">
            やり直す
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!categories) return null;

  const paymentMonthColumn = categories[Object.keys(categories)[0]]?.items.length > 0 
    ? Object.keys(categories[Object.keys(categories)[0]].items[0])[8] 
    : '8月支払金額';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground"/>
              <span className="font-medium">{file?.name}</span>
            </div>
            <Button onClick={reset} variant="ghost" size="sm">
              <X className="h-4 w-4 mr-2"/>
              クリア
            </Button>
          </div>
        </CardHeader>
      </Card>
      
      <Accordion type="single" collapsible className="space-y-2">
        {Object.entries(categories).map(([category, data]) => (
          <AccordionItem key={category} value={category} className="border rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex justify-between items-center w-full">
                <span className="text-lg font-medium">{category}</span>
                <span className="text-lg font-bold text-primary mr-4">
                  {(data as Category).total.toLocaleString()} 円
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2">利用日</th>
                      <th className="pb-2">利用店名・商品名</th>
                      <th className="pb-2 text-right">利用金額</th>
                      {category === 'その他' && <th className="pb-2 text-right">{paymentMonthColumn}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(data as Category).items.map((item: CsvRow, index: number) => {
                      const cleanedItem = Object.fromEntries(Object.entries(item).map(([k, v]) => [k.replace(/\uFEFF/g, '').trim(), v]));
                      const amount = parseInt((cleanedItem['利用金額'] || '0').replace(/,/g, ''), 10) || 0;
                      const otherAmount = category === 'その他' && paymentMonthColumn ? parseInt((cleanedItem[paymentMonthColumn] || '0').replace(/,/g, ''), 10) || 0 : 0;
                      return (
                        <tr key={index} className="hover:bg-muted/50">
                          <td className="py-2 whitespace-nowrap">{cleanedItem['利用日'] as React.ReactNode}</td>
                          <td className="py-2">{cleanedItem['利用店名・商品名'] as React.ReactNode}</td>
                          <td className="py-2 text-right whitespace-nowrap">{amount.toLocaleString()} 円</td>
                          {category === 'その他' && <td className="py-2 text-right whitespace-nowrap">{otherAmount.toLocaleString()} 円</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

// Footer Component
const AppFooter = () => (
    <footer className="text-center p-8 mt-16 border-t">
        <div className="flex justify-center items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
                <a href="https://github.com/Tsukichan555" target="_blank" rel="noopener noreferrer">
                    <Github className="h-5 w-5" />
                </a>
            </Button>
            <p className="text-muted-foreground">&copy; Tsukichan 2025</p>
        </div>
    </footer>
);


// Main App Component
export default function App() {
  const { file } = useKakeiboStore();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        {!file ? <CsvUploader /> : <ResultsDisplay />}
      </main>
      <AppFooter />
    </div>
  );
}
