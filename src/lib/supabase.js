import { createClient } from '@supabase/supabase-js'

/**
 * 從環境變數中讀取 Supabase 的連線資訊
 * 在 Vite 中，我們使用 import.meta.env 來讀取 .env.local 檔案中的內容
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 簡單的開發檢查：如果變數沒設定好，在瀏覽器的控制台 (Console) 提醒開發者
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '錯誤：找不到 Supabase 環境變數！請檢查專案根目錄下的 .env.local 檔案是否有設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。'
  )
}

/**
 * 初始化 Supabase 客戶端
 * 之後我們可以在任何組件中透過 import { supabase } from './lib/supabase' 來使用它
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)