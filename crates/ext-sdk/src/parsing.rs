//! Helpers de parsing HTML (selectores CSS) sobre las host functions del
//! modulo `parsing`. `HtmlDoc` y `Element` gestionan handles u32 con RAII.

use crate::host::Host;

/// Documento HTML con ciclo de vida gestionado por RAII.
pub struct HtmlDoc<'a> {
    pub(crate) handle: u32,
    pub(crate) host: &'a Host,
}

impl<'a> HtmlDoc<'a> {
    /// Parsea un documento HTML; el host conserva el arbol.
    pub fn parse(host: &'a Host, html: &str) -> Self {
        Self { handle: (host.parse)(html), host }
    }

    /// Selecciona elementos por selector CSS ("div.card a").
    pub fn select(&self, selector: &str) -> Vec<Element<'a>> {
        select(self.host, self.handle, selector)
    }
}

impl<'a> Drop for HtmlDoc<'a> {
    fn drop(&mut self) {
        (self.host.drop)(self.handle);
    }
}

/// Elemento del arbol; sus handles se liberan al dropear el documento.
#[derive(Clone, Copy)]
pub struct Element<'a> {
    pub(crate) handle: u32,
    pub(crate) host: &'a Host,
}

impl<'a> Element<'a> {
    pub fn attribute(&self, name: &str) -> Option<String> {
        (self.host.element_attr)(self.handle, name)
    }

    /// Atajo para `attribute("href")` con URL absoluta resuelta por el host
    /// (el host conserva el base URL del documento si el selector lo requiere).
    pub fn href(&self) -> Option<String> {
        self.attribute("href")
    }

    pub fn text(&self) -> Option<String> {
        (self.host.element_text)(self.handle)
    }

    pub fn html(&self) -> Option<String> {
        (self.host.element_html)(self.handle)
    }

    pub fn parent(&self) -> Option<Element<'a>> {
        (self.host.element_parent)(self.handle).map(|h| Element { handle: h, host: self.host })
    }

    pub fn children(&self) -> Vec<Element<'a>> {
        (self.host.element_children)(self.handle)
            .into_iter()
            .map(|h| Element { handle: h, host: self.host })
            .collect()
    }

    pub fn select(&self, selector: &str) -> Vec<Element<'a>> {
        (self.host.select)(self.handle, selector)
            .into_iter()
            .map(|h| Element { handle: h, host: self.host })
            .collect()
    }
}

/// Parsea HTML y devuelve el documento (RAII).
pub fn parse<'a>(host: &'a Host, html: &str) -> HtmlDoc<'a> {
    HtmlDoc::parse(host, html)
}

/// Selecciona elementos dentro de un documento.
pub fn select<'a>(host: &'a Host, doc: u32, selector: &str) -> Vec<Element<'a>> {
    (host.select)(doc, selector)
        .into_iter()
        .map(|handle| Element { handle, host })
        .collect()
}