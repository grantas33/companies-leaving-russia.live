import './App.css';
import {useEffect, useState} from "react";
import {CompanyWithDynamicData, MainPage} from "../../models";
import * as dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc';
import GitHubButton from 'react-github-btn'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(utc)
dayjs.extend(localizedFormat)

type CardProps = {
    company: CompanyWithDynamicData,
    setSelectedCompany: (company?: CompanyWithDynamicData) => void
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

    let [mainPage, setMainPage] = useState<MainPage>()
    let [selectedCompany, setSelectedCompany] = useState<CompanyWithDynamicData|undefined>();

    useEffect(() => {
        fetch(`/main`)
            .then(response => response.json())
            .then(m => { setMainPage(m) })
    }, [])


  return (
      <div className="App">
          <div className={"grid"}>
              { mainPage &&
                  mainPage.companies.map(it => <Card key={it.title} company={it} setSelectedCompany={company => {setSelectedCompany(company)}}/>)
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
                      {
                          selectedCompany.summary && <>
                            <i>{selectedCompany.summary}</i>
                          </>
                      }
                      {
                          selectedCompany.description && <>
                              <p>
                                  <b>Suspended operations</b>
                              </p>
                              <p>
                                  {selectedCompany.description}
                              </p>
                          </>
                      }
                      {
                          selectedCompany.sourceHtml.length > 0 && <div className={"hidden-mb"}>
                              <p>
                                  <b>Sources</b>
                              </p>
                              <ul>
                                  {selectedCompany.sourceHtml.map((it, idx) => <li key={idx} dangerouslySetInnerHTML={{__html: it}}/>)}
                              </ul>
                          </div>
                      }
                  </div>
              }
              {
                  mainPage && <div className={"bottom-strip"}>
                      <div>
                          Last updated at: {dayjs.utc(mainPage.lastUpdatedAt).local().format('L LT')}
                      </div>
                      <div>
                          <GitHubButton href={process.env.REACT_APP_GITHUB_REPO!!} data-icon="octicon-star"
                                        data-size="large"
                                        aria-label="Star me on GitHub">
                              Star
                          </GitHubButton>
                      </div>
                  </div>
              }
          </div>
      </div>
  );
}

export default App;
