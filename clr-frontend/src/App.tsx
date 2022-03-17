import './App.css';
import {useEffect, useState} from "react";
import {CompanyWithLogo} from "../../models";

type CardProps = {
    company: CompanyWithLogo,
    setSelectedCompany: (company?: CompanyWithLogo) => void
}

function Card(props: CardProps) {
    const {company, setSelectedCompany} = props

    return <div
        className={"logo-container"}
        onMouseEnter={() => setSelectedCompany(company)}
    >
        <img alt={company.title} className={"logo"} src={company.logoUrl}/>
    </div>
}

function App() {

    let [companies, setCompanies] = useState<CompanyWithLogo[]>()
    let [selectedCompany, setSelectedCompany] = useState<CompanyWithLogo|undefined>();

    useEffect(() => {
        fetch(`http://localhost:8080/list`)
            .then(response => response.json())
            .then(c => { setCompanies(c) })
    }, [])


  return (
      <div className="App">
          <div className={"grid"}>
              { companies &&
                  companies.map(it => <Card company={it} setSelectedCompany={company => {setSelectedCompany(company)}}/>)
              }
          </div>
          <div className={"sidebar"}>
              <header className="App-header">
                  Companies that applied sanctions on Russia during the Ukrainian invasion
              </header>
              {
                  selectedCompany && <div className={`selected-company`}>
                      <header className="App-header">
                          {selectedCompany.title}
                      </header>
                      <p>
                          {selectedCompany.description}
                      </p>
                  </div>
              }
          </div>
      </div>
  );
}

export default App;
