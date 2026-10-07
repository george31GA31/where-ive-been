/* Only the import summary crosses back to the UI; heavy records stay here. */
importScripts('account-model.js');
self.onmessage = event => {
  const {id, account, source} = event.data;
  try {
    const keys = ['stays','trips','profiles','residences','transports','accommodations','notes','checklists','budgets','expenses','roadTrips','currencyRates','currencyPreferences','manualCountryVisits','tccVisits','placeVisits','savedPlaces','visaAcknowledgements'];
    const preview = self.WIBModel.importData(account, source);
    const added = keys.reduce((n,key)=>n+(preview.data[key]?.length||0)-(account[key]?.length||0),0);
    const total = keys.reduce((n,key)=>n+(source[key]?.length||0),0);
    self.postMessage({id, duplicates:Math.max(0,total-added-preview.conflicts.length), conflicts:preview.conflicts.length});
  } catch {self.postMessage({id, error:true});}
};
