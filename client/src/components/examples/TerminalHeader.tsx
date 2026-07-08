import TerminalHeader from '../TerminalHeader';

export default function TerminalHeaderExample() {
  const handleSymbolSearch = (symbol: string) => {
    console.log('Symbol search triggered:', symbol);
  };

  return (
    <TerminalHeader onSymbolSearch={handleSymbolSearch} />
  );
}